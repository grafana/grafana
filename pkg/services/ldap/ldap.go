package ldap

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io/ioutil"
	"strings"

	"gopkg.in/ldap.v3"

	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana/pkg/bus"
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
	Auth(string, string) error
	Dial() error
	Close()
}

// Server is basic struct of LDAP authorization
type Server struct {
	Config     *ServerConfig
	Connection IConnection
	log        log.Logger
}

var (

	// ErrInvalidCredentials is returned if username and password do not match
	ErrInvalidCredentials = errors.New("Invalid Username or Password")
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

// Login user by searching and serializing it
func (server *Server) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo, error,
) {
	// Authentication
	err := server.Auth(query.Username, query.Password)
	if err != nil {
		return nil, err
	}

	// Find user entry & attributes
	users, err := server.Users([]string{query.Username})
	if err != nil {
		return nil, err
	}

	// If we couldn't find the user -
	// we should show incorrect credentials err
	if len(users) == 0 {
		server.disableExternalUser(query.Username)
		return nil, ErrInvalidCredentials
	}

	user := users[0]
	if err := server.validateGrafanaUser(user); err != nil {
		return nil, err
	}

	return user, nil
}

// Users gets LDAP users
func (server *Server) Users(logins []string) (
	[]*models.ExternalUserInfo,
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

	if len(result.Entries) == 0 {
		return []*models.ExternalUserInfo{}, nil
	}

	serializedUsers, err := server.serializeUsers(result)
	if err != nil {
		return nil, err
	}

	server.log.Debug("LDAP users found", "users", spew.Sdump(serializedUsers))

	return serializedUsers, nil
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

// disableExternalUser marks external user as disabled in Grafana db
func (server *Server) disableExternalUser(username string) error {
	// Check if external user exist in Grafana
	userQuery := &models.GetExternalUserInfoByLoginQuery{
		LoginOrEmail: username,
	}

	if err := bus.Dispatch(userQuery); err != nil {
		return err
	}

	userInfo := userQuery.Result
	if !userInfo.IsDisabled {
		server.log.Debug("Disabling external user", "user", userQuery.Result.Login)
		// Mark user as disabled in grafana db
		disableUserCmd := &models.DisableUserCommand{
			UserId:     userQuery.Result.UserId,
			IsDisabled: true,
		}

		if err := bus.Dispatch(disableUserCmd); err != nil {
			server.log.Debug("Error disabling external user", "user", userQuery.Result.Login, "message", err.Error())
			return err
		}
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

// shouldBindAdmin checks if we should use
// admin username & password for LDAP bind
func (server *Server) shouldBindAdmin() bool {
	return server.Config.BindPassword != ""
}

// Auth authentificates user in LDAP.
// It might not use passed password and username,
// since they can be overwritten with admin config values -
// see "bind_dn" and "bind_password" options in LDAP config
func (server *Server) Auth(username, password string) error {
	path := server.Config.BindDN

	if server.shouldBindAdmin() {
		password = server.Config.BindPassword
	} else {
		path = fmt.Sprintf(path, username)
	}

	bindFn := func() error {
		return server.Connection.Bind(path, password)
	}

	if err := bindFn(); err != nil {
		server.log.Error("Cannot authentificate in LDAP", "err", err)

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
	users *ldap.SearchResult,
) ([]*models.ExternalUserInfo, error) {
	var serialized []*models.ExternalUserInfo

	for _, user := range users.Entries {
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
