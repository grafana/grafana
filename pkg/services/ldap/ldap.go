package ldap

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io/ioutil"
	"strings"

	"gopkg.in/ldap.v3"

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
	InitialBind(string, string) error
	Dial() error
	Close()
}

// Server is basic struct of LDAP authorization
type Server struct {
	Config            *ServerConfig
	Connection        IConnection
	requireSecondBind bool
	log               log.Logger
}

var (

	// ErrInvalidCredentials is returned if username and password do not match
	ErrInvalidCredentials = errors.New("Invalid Username or Password")
)

var dial = func(network, addr string) (IConnection, error) {
	return ldap.Dial(network, addr)
}

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
				server.Connection, err = dial("tcp", address)
				if err == nil {
					if err = server.Connection.StartTLS(tlsCfg); err == nil {
						return nil
					}
				}
			} else {
				server.Connection, err = ldap.DialTLS("tcp", address, tlsCfg)
			}
		} else {
			server.Connection, err = dial("tcp", address)
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

	// Perform initial authentication
	err := server.InitialBind(query.Username, query.Password)
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

	// Check if a second user bind is needed
	user := users[0]

	if err := server.validateGrafanaUser(user); err != nil {
		return nil, err
	}

	if server.requireSecondBind {
		err = server.secondBind(user, query.Password)
		if err != nil {
			return nil, err
		}
	}

	return user, nil
}

// Users gets LDAP users
func (server *Server) Users(logins []string) (
	[]*models.ExternalUserInfo,
	error,
) {
	var result *ldap.SearchResult
	var err error
	var Config = server.Config

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

	serializedUsers, err := server.serializeUsers(result)
	if err != nil {
		return nil, err
	}

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
func (server *Server) buildGrafanaUser(user *UserInfo) *models.ExternalUserInfo {
	extUser := &models.ExternalUserInfo{
		AuthModule: models.AuthModuleLDAP,
		AuthId:     user.DN,
		Name: strings.TrimSpace(
			fmt.Sprintf("%s %s", user.FirstName, user.LastName),
		),
		Login:    user.Username,
		Email:    user.Email,
		Groups:   user.MemberOf,
		OrgRoles: map[int64]models.RoleType{},
	}

	for _, group := range server.Config.Groups {
		// only use the first match for each org
		if extUser.OrgRoles[group.OrgId] != "" {
			continue
		}

		if user.isMemberOf(group.GroupDN) {
			extUser.OrgRoles[group.OrgId] = group.OrgRole
			if extUser.IsGrafanaAdmin == nil || !*extUser.IsGrafanaAdmin {
				extUser.IsGrafanaAdmin = group.IsGrafanaAdmin
			}
		}
	}

	return extUser
}

func (server *Server) serverBind() error {
	bindFn := func() error {
		return server.Connection.Bind(
			server.Config.BindDN,
			server.Config.BindPassword,
		)
	}

	if server.Config.BindPassword == "" {
		bindFn = func() error {
			return server.Connection.UnauthenticatedBind(server.Config.BindDN)
		}
	}

	// bind_dn and bind_password to bind
	if err := bindFn(); err != nil {
		server.log.Info("LDAP initial bind failed, %v", err)

		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	return nil
}

func (server *Server) secondBind(
	user *models.ExternalUserInfo,
	userPassword string,
) error {
	err := server.Connection.Bind(user.AuthId, userPassword)
	if err != nil {
		server.log.Info("Second bind failed", "error", err)

		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	return nil
}

// InitialBind intiates first bind to LDAP server
func (server *Server) InitialBind(username, userPassword string) error {
	if server.Config.BindPassword != "" || server.Config.BindDN == "" {
		userPassword = server.Config.BindPassword
		server.requireSecondBind = true
	}

	bindPath := server.Config.BindDN
	if strings.Contains(bindPath, "%s") {
		bindPath = fmt.Sprintf(server.Config.BindDN, username)
	}

	bindFn := func() error {
		return server.Connection.Bind(bindPath, userPassword)
	}

	if userPassword == "" {
		bindFn = func() error {
			return server.Connection.UnauthenticatedBind(bindPath)
		}
	}

	if err := bindFn(); err != nil {
		server.log.Info("Initial bind failed", "error", err)

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
func (server *Server) requestMemberOf(searchResult *ldap.SearchResult) ([]string, error) {
	var memberOf []string

	for _, groupSearchBase := range server.Config.GroupSearchBaseDNs {
		var filterReplace string
		if server.Config.GroupSearchFilterUserAttribute == "" {
			filterReplace = getLDAPAttr(server.Config.Attr.Username, searchResult)
		} else {
			filterReplace = getLDAPAttr(server.Config.GroupSearchFilterUserAttribute, searchResult)
		}

		filter := strings.Replace(
			server.Config.GroupSearchFilter, "%s",
			ldap.EscapeFilter(filterReplace),
			-1,
		)

		server.log.Info("Searching for user's groups", "filter", filter)

		// support old way of reading settings
		groupIDAttribute := server.Config.Attr.MemberOf
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
			for i := range groupSearchResult.Entries {
				memberOf = append(memberOf, getLDAPAttrN(groupIDAttribute, groupSearchResult, i))
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

	for index := range users.Entries {
		memberOf, err := server.getMemberOf(users)
		if err != nil {
			return nil, err
		}

		userInfo := &UserInfo{
			DN: getLDAPAttrN(
				"dn",
				users,
				index,
			),
			LastName: getLDAPAttrN(
				server.Config.Attr.Surname,
				users,
				index,
			),
			FirstName: getLDAPAttrN(
				server.Config.Attr.Name,
				users,
				index,
			),
			Username: getLDAPAttrN(
				server.Config.Attr.Username,
				users,
				index,
			),
			Email: getLDAPAttrN(
				server.Config.Attr.Email,
				users,
				index,
			),
			MemberOf: memberOf,
		}

		serialized = append(
			serialized,
			server.buildGrafanaUser(userInfo),
		)
	}

	return serialized, nil
}

// getMemberOf finds memberOf property or request it
func (server *Server) getMemberOf(search *ldap.SearchResult) (
	[]string, error,
) {
	if server.Config.GroupSearchFilter == "" {
		memberOf := getLDAPAttrArray(server.Config.Attr.MemberOf, search)

		return memberOf, nil
	}

	memberOf, err := server.requestMemberOf(search)
	if err != nil {
		return nil, err
	}

	return memberOf, nil
}

func appendIfNotEmpty(slice []string, values ...string) []string {
	for _, v := range values {
		if v != "" {
			slice = append(slice, v)
		}
	}
	return slice
}

func getLDAPAttr(name string, result *ldap.SearchResult) string {
	return getLDAPAttrN(name, result, 0)
}

func getLDAPAttrN(name string, result *ldap.SearchResult, n int) string {
	if strings.ToLower(name) == "dn" {
		return result.Entries[n].DN
	}
	for _, attr := range result.Entries[n].Attributes {
		if attr.Name == name {
			if len(attr.Values) > 0 {
				return attr.Values[0]
			}
		}
	}
	return ""
}

func getLDAPAttrArray(name string, result *ldap.SearchResult) []string {
	return getLDAPAttrArrayN(name, result, 0)
}

func getLDAPAttrArrayN(name string, result *ldap.SearchResult, n int) []string {
	for _, attr := range result.Entries[n].Attributes {
		if attr.Name == name {
			return attr.Values
		}
	}
	return []string{}
}
