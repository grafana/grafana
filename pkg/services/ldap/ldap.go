package ldap

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"math"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-ldap/ldap/v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

// IConnection is interface for LDAP connection manipulation
type IConnection interface {
	Bind(username, password string) error
	UnauthenticatedBind(username string) error
	Add(*ldap.AddRequest) error
	Del(*ldap.DelRequest) error
	Search(*ldap.SearchRequest) (*ldap.SearchResult, error)
	StartTLS(*tls.Config) error
	Close()
}

// IServer is interface for LDAP authorization
type IServer interface {
	Login(*login.LoginUserQuery) (*login.ExternalUserInfo, error)
	Users([]string) ([]*login.ExternalUserInfo, error)
	Bind() error
	UserBind(string, string) error
	Dial() error
	Close()
}

// Server is basic struct of LDAP authorization
type Server struct {
	cfg        *setting.Cfg
	Config     *ServerConfig
	Connection IConnection
	log        log.Logger
}

// Bind authenticates the connection with the LDAP server
// - with the username and password setup in the config
// - or, anonymously
//
// Dial() sets the connection with the server for this Struct. Therefore, we require a
// call to Dial() before being able to execute this function.
func (server *Server) Bind() error {
	if server.shouldAdminBind() {
		if err := server.AdminBind(); err != nil {
			return err
		}
	} else {
		err := server.Connection.UnauthenticatedBind(server.Config.BindDN)
		if err != nil {
			return err
		}
	}
	return nil
}

// UsersMaxRequest is a max amount of users we can request via Users().
// Since many LDAP servers has limitations
// on how much items can we return in one request
const UsersMaxRequest = 500

var (

	// ErrInvalidCredentials is returned if username and password do not match
	ErrInvalidCredentials = errors.New("invalid username or password")

	// ErrCouldNotFindUser is returned when username hasn't been found (not username+password)
	ErrCouldNotFindUser = errors.New("can't find user in LDAP")
)

// New creates the new LDAP connection
func New(config *ServerConfig, cfg *setting.Cfg) IServer {
	return &Server{
		Config: config,
		cfg:    cfg,
		log:    log.New("ldap"),
	}
}

// Dial dials in the LDAP
// TODO: decrease cyclomatic complexity
func (server *Server) Dial() error {
	var err error
	var certPool *x509.CertPool
	if server.Config.RootCACert != "" {
		certPool = x509.NewCertPool()
		for _, caCertFile := range strings.Split(server.Config.RootCACert, " ") {
			// nolint:gosec
			// We can ignore the gosec G304 warning on this one because `caCertFile` comes from ldap config.
			pem, err := os.ReadFile(caCertFile)
			if err != nil {
				return err
			}
			if !certPool.AppendCertsFromPEM(pem) {
				return errors.New("Failed to append CA certificate " + caCertFile)
			}
		}
	}
	var clientCert tls.Certificate
	if server.Config.ClientCert != "" && server.Config.ClientKey != "" {
		clientCert, err = tls.LoadX509KeyPair(server.Config.ClientCert, server.Config.ClientKey)
		if err != nil {
			return err
		}
	}

	timeout := time.Duration(server.Config.Timeout) * time.Second

	for _, host := range strings.Split(server.Config.Host, " ") {
		// Remove any square brackets enclosing IPv6 addresses, a format we support for backwards compatibility
		host = strings.TrimSuffix(strings.TrimPrefix(host, "["), "]")
		address := net.JoinHostPort(host, strconv.Itoa(server.Config.Port))
		if server.Config.UseSSL {
			tlsCfg := &tls.Config{
				InsecureSkipVerify: server.Config.SkipVerifySSL,
				ServerName:         host,
				RootCAs:            certPool,
				MinVersion:         server.Config.minTLSVersion,
				CipherSuites:       server.Config.tlsCiphers,
			}
			if len(clientCert.Certificate) > 0 {
				tlsCfg.Certificates = append(tlsCfg.Certificates, clientCert)
			}
			if server.Config.StartTLS {
				server.Connection, err = dialWithTimeout("tcp", address, timeout)
				if err == nil {
					if err = server.Connection.StartTLS(tlsCfg); err == nil {
						return nil
					}
				}
			} else {
				server.Connection, err = dialTLSWithTimeout("tcp", address, tlsCfg, timeout)
			}
		} else {
			server.Connection, err = dialWithTimeout("tcp", address, timeout)
		}

		if err == nil {
			return nil
		}
	}
	return err
}

// dialWithTimeout applies the specified timeout
// and connects to the given address on the given network using net.Dial
func dialWithTimeout(network, addr string, timeout time.Duration) (*ldap.Conn, error) {
	c, err := net.DialTimeout(network, addr, timeout)
	if err != nil {
		return nil, err
	}
	conn := ldap.NewConn(c, false)
	conn.Start()
	return conn, nil
}

// dialTLSWithTimeout applies the specified timeout
// connects to the given address on the given network using tls.Dial
func dialTLSWithTimeout(network, addr string, config *tls.Config, timeout time.Duration) (*ldap.Conn, error) {
	c, err := tls.DialWithDialer(&net.Dialer{Timeout: timeout}, network, addr, config)
	if err != nil {
		return nil, err
	}
	conn := ldap.NewConn(c, true)
	conn.Start()
	return conn, nil
}

// Close closes the LDAP connection
// Dial() sets the connection with the server for this Struct. Therefore, we require a
// call to Dial() before being able to execute this function.
func (server *Server) Close() {
	server.Connection.Close()
}

// Login the user.
// There are several cases -
// 1. "admin" user
// Bind the "admin" user (defined in Grafana config file) which has the search privileges
// in LDAP server, then we search the targeted user through that bind, then the second
// perform the bind via passed login/password.
// 2. Single bind
// // If all the users meant to be used with Grafana have the ability to search in LDAP server
// then we bind with LDAP server with targeted login/password
// and then search for the said user in order to retrieve all the information about them
// 3. Unauthenticated bind
// For some LDAP configurations it is allowed to search the
// user without login/password binding with LDAP server, in such case
// we will perform "unauthenticated bind", then search for the
// targeted user and then perform the bind with passed login/password.
//
// Dial() sets the connection with the server for this Struct. Therefore, we require a
// call to Dial() before being able to execute this function.
func (server *Server) Login(query *login.LoginUserQuery) (
	*login.ExternalUserInfo, error,
) {
	var err error
	var authAndBind bool

	// Check if we can use a search user
	switch {
	case server.shouldAdminBind():
		if err := server.AdminBind(); err != nil {
			return nil, err
		}
	case server.shouldSingleBind():
		authAndBind = true
		err = server.UserBind(
			server.singleBindDN(query.Username),
			query.Password,
		)
		if err != nil {
			return nil, err
		}
	default:
		err := server.Connection.UnauthenticatedBind(server.Config.BindDN)
		if err != nil {
			return nil, err
		}
	}

	// Find user entry & attributes
	users, err := server.Users([]string{query.Username})
	if err != nil {
		return nil, err
	}

	// If we couldn't find the user -
	// we should show incorrect credentials err
	if len(users) == 0 {
		return nil, ErrCouldNotFindUser
	}

	user := users[0]
	if err := server.validateGrafanaUser(user); err != nil {
		return nil, err
	}

	if !authAndBind {
		// Authenticate user
		err = server.UserBind(user.AuthId, query.Password)
		if err != nil {
			return nil, err
		}
	}

	return user, nil
}

// shouldAdminBind checks if we should use
// admin username & password for LDAP bind
func (server *Server) shouldAdminBind() bool {
	return server.Config.BindPassword != ""
}

// singleBindDN combines the bind with the username
// in order to get the proper path
func (server *Server) singleBindDN(username string) string {
	return fmt.Sprintf(server.Config.BindDN, username)
}

// shouldSingleBind checks if we can use "single bind" approach
func (server *Server) shouldSingleBind() bool {
	return strings.Contains(server.Config.BindDN, "%s")
}

// Users gets LDAP users by logins
// Dial() sets the connection with the server for this Struct. Therefore, we require a
// call to Dial() before being able to execute this function.
func (server *Server) Users(logins []string) (
	[]*login.ExternalUserInfo,
	error,
) {
	var users [][]*ldap.Entry
	err := getUsersIteration(logins, func(previous, current int) error {
		var err error
		users, err = server.users(logins[previous:current])
		return err
	})
	if err != nil {
		return nil, err
	}

	if len(users) == 0 {
		return []*login.ExternalUserInfo{}, nil
	}

	serializedUsers, err := server.serializeUsers(users)
	if err != nil {
		return nil, err
	}

	server.log.Debug(
		"LDAP users found", "users", fmt.Sprintf("%v", serializedUsers),
	)

	return serializedUsers, nil
}

// getUsersIteration is a helper function for Users() method.
// It divides the users by equal parts for the anticipated requests
func getUsersIteration(logins []string, fn func(int, int) error) error {
	lenLogins := len(logins)
	iterations := int(
		math.Ceil(
			float64(lenLogins) / float64(UsersMaxRequest),
		),
	)

	for i := 1; i < iterations+1; i++ {
		previous := float64(UsersMaxRequest * (i - 1))
		current := math.Min(float64(i*UsersMaxRequest), float64(lenLogins))

		err := fn(int(previous), int(current))
		if err != nil {
			return err
		}
	}

	return nil
}

// users is helper method for the Users()
func (server *Server) users(logins []string) (
	[][]*ldap.Entry,
	error,
) {
	var result *ldap.SearchResult
	var Config = server.Config
	var err error

	var entries = make([][]*ldap.Entry, 0, len(Config.SearchBaseDNs))

	for _, base := range Config.SearchBaseDNs {
		result, err = server.Connection.Search(
			server.getSearchRequest(base, logins),
		)
		if err != nil {
			return nil, err
		}

		if len(result.Entries) > 0 {
			entries = append(entries, result.Entries)
		}
	}

	return entries, nil
}

// validateGrafanaUser validates user access.
// If there are no ldap group mappings access is true
// otherwise a single group must match
func (server *Server) validateGrafanaUser(user *login.ExternalUserInfo) error {
	if !server.cfg.LDAPSkipOrgRoleSync && len(server.Config.Groups) > 0 &&
		(len(user.OrgRoles) == 0 && (user.IsGrafanaAdmin == nil || !*user.IsGrafanaAdmin)) {
		server.log.Warn(
			"User does not belong in any of the specified LDAP groups",
			"username", user.Login,
			"groups", user.Groups,
		)
		return ErrInvalidCredentials
	}

	return nil
}

// getSearchRequest returns LDAP search request for users
func (server *Server) getSearchRequest(
	base string,
	logins []string,
) *ldap.SearchRequest {
	attributes := []string{}

	inputs := server.Config.Attr
	attributes = appendIfNotEmpty(
		attributes,
		inputs.Username,
		inputs.Surname,
		inputs.Email,
		inputs.Name,
		inputs.MemberOf,

		// In case for the POSIX LDAP schema server
		server.Config.GroupSearchFilterUserAttribute,
	)

	search := ""
	for _, login := range logins {
		query := strings.ReplaceAll(
			server.Config.SearchFilter,
			"%s", ldap.EscapeFilter(login),
		)

		search += query
	}

	filter := fmt.Sprintf("(|%s)", search)

	searchRequest := &ldap.SearchRequest{
		BaseDN:       base,
		Scope:        ldap.ScopeWholeSubtree,
		DerefAliases: ldap.NeverDerefAliases,
		Attributes:   attributes,
		Filter:       filter,
	}

	server.log.Debug(
		"LDAP SearchRequest", "searchRequest", fmt.Sprintf("%+v\n", searchRequest),
	)

	return searchRequest
}

// buildGrafanaUser extracts info from UserInfo model to ExternalUserInfo
func (server *Server) buildGrafanaUser(user *ldap.Entry) (*login.ExternalUserInfo, error) {
	memberOf, err := server.getMemberOf(user)
	if err != nil {
		return nil, err
	}

	attrs := server.Config.Attr
	extUser := &login.ExternalUserInfo{
		AuthModule: login.LDAPAuthModule,
		AuthId:     user.DN,
		Name: strings.TrimSpace(
			fmt.Sprintf(
				"%s %s",
				getAttribute(attrs.Name, user),
				getAttribute(attrs.Surname, user),
			),
		),
		Login:    getAttribute(attrs.Username, user),
		Email:    getAttribute(attrs.Email, user),
		Groups:   memberOf,
		OrgRoles: map[int64]org.RoleType{},
	}

	// Skipping org role sync
	if server.cfg.LDAPSkipOrgRoleSync {
		server.log.Debug("skipping organization role mapping.")
		return extUser, nil
	}

	isGrafanaAdmin := false
	for _, group := range server.Config.Groups {
		// only use the first match for each org
		if extUser.OrgRoles[group.OrgId] != "" {
			continue
		}

		if IsMemberOf(memberOf, group.GroupDN) {
			if group.OrgRole != "" {
				extUser.OrgRoles[group.OrgId] = group.OrgRole
			}

			if !isGrafanaAdmin && (group.IsGrafanaAdmin != nil && *group.IsGrafanaAdmin) {
				isGrafanaAdmin = true
			}
		}
	}
	extUser.IsGrafanaAdmin = &isGrafanaAdmin

	// If there are group org mappings configured, but no matching mappings,
	// the user will not be able to login and will be disabled
	if len(server.Config.Groups) > 0 && (len(extUser.OrgRoles) == 0 && (extUser.IsGrafanaAdmin == nil || !*extUser.IsGrafanaAdmin)) {
		extUser.IsDisabled = true
	}

	return extUser, nil
}

// UserBind binds the user with the LDAP server
// Dial() sets the connection with the server for this Struct. Therefore, we require a
// call to Dial() before being able to execute this function.
func (server *Server) UserBind(username, password string) error {
	err := server.userBind(username, password)
	if err != nil {
		server.log.Error(
			fmt.Sprintf("Cannot bind user %s with LDAP", username),
			"error",
			err,
		)
		return err
	}

	return nil
}

// AdminBind binds "admin" user with LDAP
// Dial() sets the connection with the server for this Struct. Therefore, we require a
// call to Dial() before being able to execute this function.
func (server *Server) AdminBind() error {
	err := server.userBind(server.Config.BindDN, server.Config.BindPassword)
	if err != nil {
		server.log.Error(
			"Cannot authenticate admin user in LDAP. Verify bind configuration",
			"error",
			err,
		)
		return err
	}

	return nil
}

// userBind binds the user with the LDAP server
func (server *Server) userBind(path, password string) error {
	err := server.Connection.Bind(path, password)
	if err != nil {
		var ldapErr *ldap.Error
		if errors.As(err, &ldapErr) && ldapErr.ResultCode == 49 {
			return ErrInvalidCredentials
		}

		return err
	}

	return nil
}

// requestMemberOf use this function when POSIX LDAP
// schema does not support memberOf, so it manually search the groups
func (server *Server) requestMemberOf(entry *ldap.Entry) ([]string, error) {
	var memberOf []string
	var config = server.Config
	var searchBaseDNs []string

	if len(config.GroupSearchBaseDNs) > 0 {
		searchBaseDNs = config.GroupSearchBaseDNs
	} else {
		searchBaseDNs = config.SearchBaseDNs
	}

	for _, groupSearchBase := range searchBaseDNs {
		var filterReplace string
		if config.GroupSearchFilterUserAttribute == "" {
			filterReplace = getAttribute(config.Attr.Username, entry)
		} else {
			filterReplace = getAttribute(
				config.GroupSearchFilterUserAttribute,
				entry,
			)
		}

		filter := strings.ReplaceAll(
			config.GroupSearchFilter, "%s",
			ldap.EscapeFilter(filterReplace),
		)

		server.log.Info("Searching for user's groups", "filter", filter)

		// support old way of reading settings
		groupIDAttribute := config.Attr.MemberOf
		// but prefer dn attribute if default settings are used
		if groupIDAttribute == "" || groupIDAttribute == "memberOf" {
			groupIDAttribute = "dn"
		}

		groupSearchReq := ldap.SearchRequest{
			BaseDN:       groupSearchBase,
			Scope:        ldap.ScopeWholeSubtree,
			DerefAliases: ldap.NeverDerefAliases,
			Attributes:   []string{groupIDAttribute},
			Filter:       filter,
		}

		groupSearchResult, err := server.Connection.Search(&groupSearchReq)
		if err != nil {
			return nil, err
		}

		if len(groupSearchResult.Entries) > 0 {
			for _, group := range groupSearchResult.Entries {
				memberOf = append(
					memberOf,
					getAttribute(groupIDAttribute, group),
				)
			}
		}
	}

	return memberOf, nil
}

// serializeUsers serializes the users
// from LDAP result to ExternalInfo struct
func (server *Server) serializeUsers(
	entries [][]*ldap.Entry,
) ([]*login.ExternalUserInfo, error) {
	var serialized []*login.ExternalUserInfo
	var users = map[string]struct{}{}

	for _, dn := range entries {
		for _, user := range dn {
			extUser, err := server.buildGrafanaUser(user)
			if err != nil {
				return nil, err
			}

			if _, exists := users[extUser.Login]; exists {
				// ignore duplicates
				continue
			}
			users[extUser.Login] = struct{}{}

			serialized = append(serialized, extUser)
		}
	}

	return serialized, nil
}

// getMemberOf finds memberOf property or request it
func (server *Server) getMemberOf(result *ldap.Entry) (
	[]string, error,
) {
	if server.Config.GroupSearchFilter == "" {
		memberOf := getArrayAttribute(server.Config.Attr.MemberOf, result)

		return memberOf, nil
	}

	memberOf, err := server.requestMemberOf(result)
	if err != nil {
		return nil, err
	}

	return memberOf, nil
}
