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
	Add(string, map[string][]string) error
	Remove(string) error
	Users([]string) ([]*models.ExternalUserInfo, error)
	ExtractGrafanaUser(*UserInfo) (*models.ExternalUserInfo, error)
	Dial() error
	Close()
}

// Server is basic struct of LDAP authorization
type Server struct {
	config            *ServerConfig
	connection        IConnection
	requireSecondBind bool
	log               log.Logger
}

var (

	// ErrInvalidCredentials is returned if username and password do not match
	ErrInvalidCredentials = errors.New("Invalid Username or Password")
	ErrLDAPUserNotFound   = errors.New("LDAP user not found")
)

var dial = func(network, addr string) (IConnection, error) {
	return ldap.Dial(network, addr)
}

// New creates the new LDAP auth
func New(config *ServerConfig) IServer {
	return &Server{
		config: config,
		log:    log.New("ldap"),
	}
}

// Dial dials in the LDAP
func (server *Server) Dial() error {
	var err error
	var certPool *x509.CertPool
	if server.config.RootCACert != "" {
		certPool = x509.NewCertPool()
		for _, caCertFile := range strings.Split(server.config.RootCACert, " ") {
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
	if server.config.ClientCert != "" && server.config.ClientKey != "" {
		clientCert, err = tls.LoadX509KeyPair(server.config.ClientCert, server.config.ClientKey)
		if err != nil {
			return err
		}
	}
	for _, host := range strings.Split(server.config.Host, " ") {
		address := fmt.Sprintf("%s:%d", host, server.config.Port)
		if server.config.UseSSL {
			tlsCfg := &tls.Config{
				InsecureSkipVerify: server.config.SkipVerifySSL,
				ServerName:         host,
				RootCAs:            certPool,
			}
			if len(clientCert.Certificate) > 0 {
				tlsCfg.Certificates = append(tlsCfg.Certificates, clientCert)
			}
			if server.config.StartTLS {
				server.connection, err = dial("tcp", address)
				if err == nil {
					if err = server.connection.StartTLS(tlsCfg); err == nil {
						return nil
					}
				}
			} else {
				server.connection, err = ldap.DialTLS("tcp", address, tlsCfg)
			}
		} else {
			server.connection, err = dial("tcp", address)
		}

		if err == nil {
			return nil
		}
	}
	return err
}

// Close closes the LDAP connection
func (server *Server) Close() {
	server.connection.Close()
}

// Log in user by searching and serializing it
func (server *Server) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo, error,
) {

	// Perform initial authentication
	err := server.initialBind(query.Username, query.Password)
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
	if server.requireSecondBind {
		err = server.secondBind(user, query.Password)
		if err != nil {
			return nil, err
		}
	}

	return user, nil
}

// Add adds stuff to LDAP
func (server *Server) Add(dn string, values map[string][]string) error {
	err := server.initialBind(
		server.config.BindDN,
		server.config.BindPassword,
	)
	if err != nil {
		return err
	}

	attributes := make([]ldap.Attribute, 0)
	for key, value := range values {
		attributes = append(attributes, ldap.Attribute{
			Type: key,
			Vals: value,
		})
	}

	request := &ldap.AddRequest{
		DN:         dn,
		Attributes: attributes,
	}

	err = server.connection.Add(request)
	if err != nil {
		return err
	}

	return nil
}

// Remove removes stuff from LDAP
func (server *Server) Remove(dn string) error {
	err := server.initialBind(
		server.config.BindDN,
		server.config.BindPassword,
	)
	if err != nil {
		return err
	}

	request := ldap.NewDelRequest(dn, nil)
	err = server.connection.Del(request)
	if err != nil {
		return err
	}

	return nil
}

// Users gets LDAP users
func (server *Server) Users(logins []string) (
	[]*models.ExternalUserInfo,
	error,
) {
	var result *ldap.SearchResult
	var err error
	var config = server.config

	for _, base := range config.SearchBaseDNs {
		result, err = server.connection.Search(
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

// ExtractGrafanaUser extracts external user info from LDAP user
func (server *Server) ExtractGrafanaUser(user *UserInfo) (*models.ExternalUserInfo, error) {
	result := server.buildGrafanaUser(user)
	if err := server.validateGrafanaUser(result); err != nil {
		return nil, err
	}

	return result, nil
}

// validateGrafanaUser validates user access.
// If there are no ldap group mappings access is true
// otherwise a single group must match
func (server *Server) validateGrafanaUser(user *models.ExternalUserInfo) error {
	if len(server.config.Groups) > 0 && len(user.OrgRoles) < 1 {
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

	inputs := server.config.Attr
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
			server.config.SearchFilter,
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

	for _, group := range server.config.Groups {
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
		return server.connection.Bind(
			server.config.BindDN,
			server.config.BindPassword,
		)
	}

	if server.config.BindPassword == "" {
		bindFn = func() error {
			return server.connection.UnauthenticatedBind(server.config.BindDN)
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
	err := server.connection.Bind(user.AuthId, userPassword)
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

func (server *Server) initialBind(username, userPassword string) error {
	if server.config.BindPassword != "" || server.config.BindDN == "" {
		userPassword = server.config.BindPassword
		server.requireSecondBind = true
	}

	bindPath := server.config.BindDN
	if strings.Contains(bindPath, "%s") {
		bindPath = fmt.Sprintf(server.config.BindDN, username)
	}

	bindFn := func() error {
		return server.connection.Bind(bindPath, userPassword)
	}

	if userPassword == "" {
		bindFn = func() error {
			return server.connection.UnauthenticatedBind(bindPath)
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

	for _, groupSearchBase := range server.config.GroupSearchBaseDNs {
		var filterReplace string
		if server.config.GroupSearchFilterUserAttribute == "" {
			filterReplace = getLdapAttr(server.config.Attr.Username, searchResult)
		} else {
			filterReplace = getLdapAttr(server.config.GroupSearchFilterUserAttribute, searchResult)
		}

		filter := strings.Replace(
			server.config.GroupSearchFilter, "%s",
			ldap.EscapeFilter(filterReplace),
			-1,
		)

		server.log.Info("Searching for user's groups", "filter", filter)

		// support old way of reading settings
		groupIDAttribute := server.config.Attr.MemberOf
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

		groupSearchResult, err := server.connection.Search(&groupSearchReq)
		if err != nil {
			return nil, err
		}

		if len(groupSearchResult.Entries) > 0 {
			for i := range groupSearchResult.Entries {
				memberOf = append(memberOf, getLdapAttrN(groupIDAttribute, groupSearchResult, i))
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
			DN: getLdapAttrN(
				"dn",
				users,
				index,
			),
			LastName: getLdapAttrN(
				server.config.Attr.Surname,
				users,
				index,
			),
			FirstName: getLdapAttrN(
				server.config.Attr.Name,
				users,
				index,
			),
			Username: getLdapAttrN(
				server.config.Attr.Username,
				users,
				index,
			),
			Email: getLdapAttrN(
				server.config.Attr.Email,
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
	if server.config.GroupSearchFilter == "" {
		memberOf := getLdapAttrArray(server.config.Attr.MemberOf, search)

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

func getLdapAttr(name string, result *ldap.SearchResult) string {
	return getLdapAttrN(name, result, 0)
}

func getLdapAttrN(name string, result *ldap.SearchResult, n int) string {
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

func getLdapAttrArray(name string, result *ldap.SearchResult) []string {
	return getLdapAttrArrayN(name, result, 0)
}

func getLdapAttrArrayN(name string, result *ldap.SearchResult, n int) []string {
	for _, attr := range result.Entries[n].Attributes {
		if attr.Name == name {
			return attr.Values
		}
	}
	return []string{}
}
