package ldap

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io/ioutil"
	"math"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
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
	Login(*models.LoginUserQuery) (*models.ExternalUserInfo, error)
	Users([]string) ([]*models.ExternalUserInfo, error)
	Bind() error
	UserBind(string, string) error
	Dial() error
	Close()
}

// Server is basic struct of LDAP authorization
type Server struct {
	Config     *ServerConfig
	Connection IConnection
	log        log.Logger
}

// Bind authenticates the connection with the LDAP server
// - with the username and password setup in the config
// - or, anonymously
func (server *Server) Bind() error {
	if server.shouldAuthAdmin() {
		if err := server.AuthAdmin(); err != nil {
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
	ErrInvalidCredentials = errors.New("Invalid Username or Password")

	// ErrCouldNotFindUser is returned when username hasn't been found (not username+password)
	ErrCouldNotFindUser = errors.New("Can't find user in LDAP")
)

// New creates the new LDAP auth
func New(config *ServerConfig) IServer {
	return &Server{
		Config: config,
		log:    log.New("ldap"),
	}
}

// Dial dials in the LDAP
func (server *Server) Dial() error {
	var err error
	var certPool *x509.CertPool
	if server.Config.RootCACert != "" {
		certPool = x509.NewCertPool()
		for _, caCertFile := range strings.Split(server.Config.RootCACert, " ") {
			pem, err := ioutil.ReadFile(caCertFile)
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
	for _, host := range strings.Split(server.Config.Host, " ") {
		address := fmt.Sprintf("%s:%d", host, server.Config.Port)
		if server.Config.UseSSL {
			tlsCfg := &tls.Config{
				InsecureSkipVerify: server.Config.SkipVerifySSL,
				ServerName:         host,
				RootCAs:            certPool,
			}
			if len(clientCert.Certificate) > 0 {
				tlsCfg.Certificates = append(tlsCfg.Certificates, clientCert)
			}
			if server.Config.StartTLS {
				server.Connection, err = ldap.Dial("tcp", address)
				if err == nil {
					if err = server.Connection.StartTLS(tlsCfg); err == nil {
						return nil
					}
				}
			} else {
				server.Connection, err = ldap.DialTLS("tcp", address, tlsCfg)
			}
		} else {
			server.Connection, err = ldap.Dial("tcp", address)
		}

		if err == nil {
			return nil
		}
	}
	return err
}

// Close closes the LDAP connection
func (server *Server) Close() {
	server.Connection.Close()
}

// Login the user.
// There is several cases -
// 1. First we check if we need to authenticate the admin user.
// That user should have search privileges.
// 2. For some configurations it is allowed to search the
// user without any authenfication, in such case we
// perform "unauthenticated bind".
// --
// After either first or second step is done we find the user DN
// by its username, after that, we then combine it with user password and
// then try to authentificate that user
func (server *Server) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo, error,
) {
	var err error
	var authAndBind bool

	// Check if we can use a search user
	if server.shouldAuthAdmin() {
		if err := server.AuthAdmin(); err != nil {
			return nil, err
		}
	} else if server.shouldSingleBind() {
		authAndBind = true
		err = server.UserBind(server.singleBindDN(query.Username), query.Password)
		if err != nil {
			return nil, err
		}
	} else {
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

func (server *Server) singleBindDN(username string) string {
	return fmt.Sprintf(server.Config.BindDN, username)
}

func (server *Server) shouldSingleBind() bool {
	return strings.Contains(server.Config.BindDN, "%s")
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

// Users gets LDAP users
func (server *Server) Users(logins []string) (
	[]*models.ExternalUserInfo,
	error,
) {
	var users []*ldap.Entry
	err := getUsersIteration(logins, func(previous, current int) error {
		entries, err := server.users(logins[previous:current])
		if err != nil {
			return err
		}

		users = append(users, entries...)

		return nil
	})
	if err != nil {
		return nil, err
	}

	if len(users) == 0 {
		return []*models.ExternalUserInfo{}, nil
	}

	serializedUsers, err := server.serializeUsers(users)
	if err != nil {
		return nil, err
	}

	server.log.Debug("LDAP users found", "users", spew.Sdump(serializedUsers))

	return serializedUsers, nil
}

// users is helper method for the Users()
func (server *Server) users(logins []string) (
	[]*ldap.Entry,
	error,
) {
	var result *ldap.SearchResult
	var Config = server.Config
	var err error

	for _, base := range Config.SearchBaseDNs {
		result, err = server.Connection.Search(
			server.getSearchRequest(base, logins),
		)
		if err != nil {
			return nil, err
		}

		if len(result.Entries) > 0 {
			break
		}
	}

	return result.Entries, nil
}

// validateGrafanaUser validates user access.
// If there are no ldap group mappings access is true
// otherwise a single group must match
func (server *Server) validateGrafanaUser(user *models.ExternalUserInfo) error {
	if len(server.Config.Groups) > 0 && len(user.OrgRoles) < 1 {
		server.log.Error(
			"user does not belong in any of the specified LDAP groups",
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
	)

	search := ""
	for _, login := range logins {
		query := strings.Replace(
			server.Config.SearchFilter,
			"%s", ldap.EscapeFilter(login),
			-1,
		)

		search = search + query
	}

	filter := fmt.Sprintf("(|%s)", search)

	return &ldap.SearchRequest{
		BaseDN:       base,
		Scope:        ldap.ScopeWholeSubtree,
		DerefAliases: ldap.NeverDerefAliases,
		Attributes:   attributes,
		Filter:       filter,
	}
}

// buildGrafanaUser extracts info from UserInfo model to ExternalUserInfo
func (server *Server) buildGrafanaUser(user *ldap.Entry) (*models.ExternalUserInfo, error) {
	memberOf, err := server.getMemberOf(user)
	if err != nil {
		return nil, err
	}

	attrs := server.Config.Attr
	extUser := &models.ExternalUserInfo{
		AuthModule: models.AuthModuleLDAP,
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
		OrgRoles: map[int64]models.RoleType{},
	}

	for _, group := range server.Config.Groups {
		// only use the first match for each org
		if extUser.OrgRoles[group.OrgID] != "" {
			continue
		}

		if isMemberOf(memberOf, group.GroupDN) {
			extUser.OrgRoles[group.OrgID] = group.OrgRole
			if extUser.IsGrafanaAdmin == nil || !*extUser.IsGrafanaAdmin {
				extUser.IsGrafanaAdmin = group.IsGrafanaAdmin
			}
		}
	}

	return extUser, nil
}

// shouldAuthAdmin checks if we should use
// admin username & password for LDAP bind
func (server *Server) shouldAuthAdmin() bool {
	return server.Config.BindPassword != ""
}

// UserBind authenticates the connection with the LDAP server
func (server *Server) UserBind(username, password string) error {
	err := server.userBind(username, password)
	if err != nil {
		server.log.Error(
			fmt.Sprintf("Cannot authentificate user %s in LDAP", username),
			"error",
			err,
		)
		return err
	}

	return nil
}

// AuthAdmin authentificates LDAP admin user
func (server *Server) AuthAdmin() error {
	err := server.userBind(server.Config.BindDN, server.Config.BindPassword)
	if err != nil {
		server.log.Error(
			"Cannot authentificate admin user in LDAP",
			"error",
			err,
		)
		return err
	}

	return nil
}

// userBind authenticates the connection with the LDAP server
func (server *Server) userBind(path, password string) error {
	err := server.Connection.Bind(path, password)
	if err != nil {
		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	return nil
}

// requestMemberOf use this function when POSIX LDAP schema does not support memberOf, so it manually search the groups
func (server *Server) requestMemberOf(entry *ldap.Entry) ([]string, error) {
	var memberOf []string
	var config = server.Config

	for _, groupSearchBase := range config.GroupSearchBaseDNs {
		var filterReplace string
		if config.GroupSearchFilterUserAttribute == "" {
			filterReplace = getAttribute(config.Attr.Username, entry)
		} else {
			filterReplace = getAttribute(
				config.GroupSearchFilterUserAttribute,
				entry,
			)
		}

		filter := strings.Replace(
			config.GroupSearchFilter, "%s",
			ldap.EscapeFilter(filterReplace),
			-1,
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
			break
		}
	}

	return memberOf, nil
}

// serializeUsers serializes the users
// from LDAP result to ExternalInfo struct
func (server *Server) serializeUsers(
	entries []*ldap.Entry,
) ([]*models.ExternalUserInfo, error) {
	var serialized []*models.ExternalUserInfo

	for _, user := range entries {
		extUser, err := server.buildGrafanaUser(user)
		if err != nil {
			return nil, err
		}

		serialized = append(serialized, extUser)
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
