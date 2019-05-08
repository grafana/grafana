package ldap

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io/ioutil"
	"strings"

	"github.com/davecgh/go-spew/spew"
	LDAP "gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

// IConnection is interface for LDAP connection manipulation
type IConnection interface {
	Bind(username, password string) error
	UnauthenticatedBind(username string) error
	Search(*LDAP.SearchRequest) (*LDAP.SearchResult, error)
	StartTLS(*tls.Config) error
	Close()
}

// IAuth is interface for LDAP authorization
type IAuth interface {
	Login(query *models.LoginUserQuery) (*models.ExternalUserInfo, error)
	User(login *models.LoginUserQuery) (*models.ExternalUserInfo, error)
	Users() ([]*models.ExternalUserInfo, error)
	Dial() error
	Close()
}

// Auth is basic struct of LDAP authorization
type Auth struct {
	server            *ServerConfig
	connection        IConnection
	requireSecondBind bool
	log               log.Logger
}

var (

	// ErrInvalidCredentials is returned if username and password do not match
	ErrInvalidCredentials = errors.New("Invalid Username or Password")
)

var dial = func(network, addr string) (IConnection, error) {
	return LDAP.Dial(network, addr)
}

// New creates the new LDAP auth
func New(server *ServerConfig) IAuth {
	return &Auth{
		server: server,
		log:    log.New("ldap"),
	}
}

// Dial dials in the LDAP
func (auth *Auth) Dial() error {
	if hookDial != nil {
		return hookDial(auth)
	}

	var err error
	var certPool *x509.CertPool
	if auth.server.RootCACert != "" {
		certPool = x509.NewCertPool()
		for _, caCertFile := range strings.Split(auth.server.RootCACert, " ") {
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
	if auth.server.ClientCert != "" && auth.server.ClientKey != "" {
		clientCert, err = tls.LoadX509KeyPair(auth.server.ClientCert, auth.server.ClientKey)
		if err != nil {
			return err
		}
	}
	for _, host := range strings.Split(auth.server.Host, " ") {
		address := fmt.Sprintf("%s:%d", host, auth.server.Port)
		if auth.server.UseSSL {
			tlsCfg := &tls.Config{
				InsecureSkipVerify: auth.server.SkipVerifySSL,
				ServerName:         host,
				RootCAs:            certPool,
			}
			if len(clientCert.Certificate) > 0 {
				tlsCfg.Certificates = append(tlsCfg.Certificates, clientCert)
			}
			if auth.server.StartTLS {
				auth.connection, err = dial("tcp", address)
				if err == nil {
					if err = auth.connection.StartTLS(tlsCfg); err == nil {
						return nil
					}
				}
			} else {
				auth.connection, err = LDAP.DialTLS("tcp", address, tlsCfg)
			}
		} else {
			auth.connection, err = dial("tcp", address)
		}

		if err == nil {
			return nil
		}
	}
	return err
}

// Close closes the LDAP connection
func (auth *Auth) Close() {
	auth.connection.Close()
}

// Login logs in the user
func (ldap *Auth) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo, error,
) {
	// perform initial authentication
	if err := ldap.initialBind(query.Username, query.Password); err != nil {
		return nil, err
	}

	// find user entry & attributes
	user, err := ldap.searchForUser(query.Username)
	if err != nil {
		return nil, err
	}

	// check if a second user bind is needed
	if ldap.requireSecondBind {
		err = ldap.secondBind(user, query.Password)
		if err != nil {
			return nil, err
		}
	}

	result, err := ldap.ExtractExternalUser(user)
	if err != nil {
		return nil, err
	}

	return result, nil
}

// User gets user from LDAP
func (ldap *Auth) User(login *models.LoginUserQuery) (*models.ExternalUserInfo, error) {
	err := ldap.serverBind()
	if err != nil {
		return nil, err
	}

	// find user entry & attributes
	user, err := ldap.searchForUser(login.Username)
	if err != nil {
		ldap.log.Error("Failed searching for user in ldap", "error", err)
		return nil, err
	}

	result, err := ldap.ExtractExternalUser(user)
	if err != nil {
		return nil, err
	}

	return result, nil
}

// ExtractExternalUser extracts external user info from LDAP user
func (ldap *Auth) ExtractExternalUser(user *UserInfo) (*models.ExternalUserInfo, error) {
	result := ldap.buildExternalUser(user)
	if err := ldap.validateExternalUser(result); err != nil {
		return nil, err
	}

	return result, nil
}

// validate that the user has access
// if there are no ldap group mappings access is true
// otherwise a single group must match
func (ldap *Auth) validateExternalUser(user *models.ExternalUserInfo) error {
	if len(ldap.server.Groups) > 0 && len(user.OrgRoles) < 1 {
		ldap.log.Error(
			"Ldap Auth: user does not belong in any of the specified ldap groups",
			"username", user.Login,
			"groups", user.Groups,
		)
		return ErrInvalidCredentials
	}

	return nil
}

func (ldap *Auth) buildExternalUser(user *UserInfo) *models.ExternalUserInfo {
	extUser := &models.ExternalUserInfo{
		AuthModule: "ldap",
		AuthId:     user.DN,
		Name:       fmt.Sprintf("%s %s", user.FirstName, user.LastName),
		Login:      user.Username,
		Email:      user.Email,
		Groups:     user.MemberOf,
		OrgRoles:   map[int64]models.RoleType{},
	}

	for _, group := range ldap.server.Groups {
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

func (auth *Auth) serverBind() error {
	bindFn := func() error {
		return auth.connection.Bind(auth.server.BindDN, auth.server.BindPassword)
	}

	if auth.server.BindPassword == "" {
		bindFn = func() error {
			return auth.connection.UnauthenticatedBind(auth.server.BindDN)
		}
	}

	// bind_dn and bind_password to bind
	if err := bindFn(); err != nil {
		auth.log.Info("LDAP initial bind failed, %v", err)

		if ldapErr, ok := err.(*LDAP.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	return nil
}

func (auth *Auth) secondBind(user *UserInfo, userPassword string) error {
	if err := auth.connection.Bind(user.DN, userPassword); err != nil {
		auth.log.Info("Second bind failed", "error", err)

		if ldapErr, ok := err.(*LDAP.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	return nil
}

func (auth *Auth) initialBind(username, userPassword string) error {
	if auth.server.BindPassword != "" || auth.server.BindDN == "" {
		userPassword = auth.server.BindPassword
		auth.requireSecondBind = true
	}

	bindPath := auth.server.BindDN
	if strings.Contains(bindPath, "%s") {
		bindPath = fmt.Sprintf(auth.server.BindDN, username)
	}

	bindFn := func() error {
		return auth.connection.Bind(bindPath, userPassword)
	}

	if userPassword == "" {
		bindFn = func() error {
			return auth.connection.UnauthenticatedBind(bindPath)
		}
	}

	if err := bindFn(); err != nil {
		auth.log.Info("Initial bind failed", "error", err)

		if ldapErr, ok := err.(*LDAP.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	return nil
}

func (auth *Auth) searchForUser(username string) (*UserInfo, error) {
	var searchResult *LDAP.SearchResult
	var err error

	for _, searchBase := range auth.server.SearchBaseDNs {
		attributes := make([]string, 0)
		inputs := auth.server.Attr
		attributes = appendIfNotEmpty(attributes,
			inputs.Username,
			inputs.Surname,
			inputs.Email,
			inputs.Name,
			inputs.MemberOf)

		searchReq := LDAP.SearchRequest{
			BaseDN:       searchBase,
			Scope:        LDAP.ScopeWholeSubtree,
			DerefAliases: LDAP.NeverDerefAliases,
			Attributes:   attributes,
			Filter: strings.Replace(
				auth.server.SearchFilter,
				"%s", LDAP.EscapeFilter(username),
				-1,
			),
		}

		auth.log.Debug("Ldap Search For User Request", "info", spew.Sdump(searchReq))

		searchResult, err = auth.connection.Search(&searchReq)
		if err != nil {
			return nil, err
		}

		if len(searchResult.Entries) > 0 {
			break
		}
	}

	if len(searchResult.Entries) == 0 {
		return nil, ErrInvalidCredentials
	}

	if len(searchResult.Entries) > 1 {
		return nil, errors.New("Ldap search matched more than one entry, please review your filter setting")
	}

	var memberOf []string
	if auth.server.GroupSearchFilter == "" {
		memberOf = getLdapAttrArray(auth.server.Attr.MemberOf, searchResult)
	} else {
		// If we are using a POSIX LDAP schema it won't support memberOf, so we manually search the groups
		var groupSearchResult *LDAP.SearchResult
		for _, groupSearchBase := range auth.server.GroupSearchBaseDNs {
			var filter_replace string
			if auth.server.GroupSearchFilterUserAttribute == "" {
				filter_replace = getLdapAttr(auth.server.Attr.Username, searchResult)
			} else {
				filter_replace = getLdapAttr(auth.server.GroupSearchFilterUserAttribute, searchResult)
			}

			filter := strings.Replace(
				auth.server.GroupSearchFilter, "%s",
				LDAP.EscapeFilter(filter_replace),
				-1,
			)

			auth.log.Info("Searching for user's groups", "filter", filter)

			// support old way of reading settings
			groupIdAttribute := auth.server.Attr.MemberOf
			// but prefer dn attribute if default settings are used
			if groupIdAttribute == "" || groupIdAttribute == "memberOf" {
				groupIdAttribute = "dn"
			}

			groupSearchReq := LDAP.SearchRequest{
				BaseDN:       groupSearchBase,
				Scope:        LDAP.ScopeWholeSubtree,
				DerefAliases: LDAP.NeverDerefAliases,
				Attributes:   []string{groupIdAttribute},
				Filter:       filter,
			}

			groupSearchResult, err = auth.connection.Search(&groupSearchReq)
			if err != nil {
				return nil, err
			}

			if len(groupSearchResult.Entries) > 0 {
				for i := range groupSearchResult.Entries {
					memberOf = append(memberOf, getLdapAttrN(groupIdAttribute, groupSearchResult, i))
				}
				break
			}
		}
	}

	return &UserInfo{
		DN:        searchResult.Entries[0].DN,
		LastName:  getLdapAttr(auth.server.Attr.Surname, searchResult),
		FirstName: getLdapAttr(auth.server.Attr.Name, searchResult),
		Username:  getLdapAttr(auth.server.Attr.Username, searchResult),
		Email:     getLdapAttr(auth.server.Attr.Email, searchResult),
		MemberOf:  memberOf,
	}, nil
}

// Users gets LDAP users
func (ldap *Auth) Users() ([]*models.ExternalUserInfo, error) {
	var result *LDAP.SearchResult
	var err error
	server := ldap.server

	for _, base := range server.SearchBaseDNs {
		attributes := make([]string, 0)
		inputs := server.Attr
		attributes = appendIfNotEmpty(
			attributes,
			inputs.Username,
			inputs.Surname,
			inputs.Email,
			inputs.Name,
			inputs.MemberOf,
		)

		req := LDAP.SearchRequest{
			BaseDN:       base,
			Scope:        LDAP.ScopeWholeSubtree,
			DerefAliases: LDAP.NeverDerefAliases,
			Attributes:   attributes,

			// Doing a star here to get all the users in one go
			Filter: strings.Replace(server.SearchFilter, "%s", "*", -1),
		}

		result, err = ldap.connection.Search(&req)
		if err != nil {
			return nil, err
		}

		if len(result.Entries) > 0 {
			break
		}
	}

	return ldap.serializeUsers(result), nil
}

func (ldap *Auth) serializeUsers(users *LDAP.SearchResult) []*models.ExternalUserInfo {
	var serialized []*models.ExternalUserInfo

	for index := range users.Entries {
		serialize := ldap.buildExternalUser(&UserInfo{
			DN: getLdapAttrN(
				"dn",
				users,
				index,
			),
			LastName: getLdapAttrN(
				ldap.server.Attr.Surname,
				users,
				index,
			),
			FirstName: getLdapAttrN(
				ldap.server.Attr.Name,
				users,
				index,
			),
			Username: getLdapAttrN(
				ldap.server.Attr.Username,
				users,
				index,
			),
			Email: getLdapAttrN(
				ldap.server.Attr.Email,
				users,
				index,
			),
			MemberOf: getLdapAttrArrayN(
				ldap.server.Attr.MemberOf,
				users,
				index,
			),
		})

		serialized = append(serialized, serialize)
	}

	return serialized
}

func appendIfNotEmpty(slice []string, values ...string) []string {
	for _, v := range values {
		if v != "" {
			slice = append(slice, v)
		}
	}
	return slice
}

func getLdapAttr(name string, result *LDAP.SearchResult) string {
	return getLdapAttrN(name, result, 0)
}

func getLdapAttrN(name string, result *LDAP.SearchResult, n int) string {
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

func getLdapAttrArray(name string, result *LDAP.SearchResult) []string {
	return getLdapAttrArrayN(name, result, 0)
}

func getLdapAttrArrayN(name string, result *LDAP.SearchResult, n int) []string {
	for _, attr := range result.Entries[n].Attributes {
		if attr.Name == name {
			return attr.Values
		}
	}
	return []string{}
}
