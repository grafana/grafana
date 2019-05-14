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
	Add(*LDAP.AddRequest) error
	Search(*LDAP.SearchRequest) (*LDAP.SearchResult, error)
	StartTLS(*tls.Config) error
	Close()
}

// IAuth is interface for LDAP authorization
type IAuth interface {
	Login(*models.LoginUserQuery) (*models.ExternalUserInfo, error)
	Add(string, map[string][]string) error
	Users() ([]*models.ExternalUserInfo, error)
	ExtractGrafanaUser(*UserInfo) (*models.ExternalUserInfo, error)
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
func (ldap *Auth) Dial() error {
	if hookDial != nil {
		return hookDial(ldap)
	}

	var err error
	var certPool *x509.CertPool
	if ldap.server.RootCACert != "" {
		certPool = x509.NewCertPool()
		for _, caCertFile := range strings.Split(ldap.server.RootCACert, " ") {
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
	if ldap.server.ClientCert != "" && ldap.server.ClientKey != "" {
		clientCert, err = tls.LoadX509KeyPair(ldap.server.ClientCert, ldap.server.ClientKey)
		if err != nil {
			return err
		}
	}
	for _, host := range strings.Split(ldap.server.Host, " ") {
		address := fmt.Sprintf("%s:%d", host, ldap.server.Port)
		if ldap.server.UseSSL {
			tlsCfg := &tls.Config{
				InsecureSkipVerify: ldap.server.SkipVerifySSL,
				ServerName:         host,
				RootCAs:            certPool,
			}
			if len(clientCert.Certificate) > 0 {
				tlsCfg.Certificates = append(tlsCfg.Certificates, clientCert)
			}
			if ldap.server.StartTLS {
				ldap.connection, err = dial("tcp", address)
				if err == nil {
					if err = ldap.connection.StartTLS(tlsCfg); err == nil {
						return nil
					}
				}
			} else {
				ldap.connection, err = LDAP.DialTLS("tcp", address, tlsCfg)
			}
		} else {
			ldap.connection, err = dial("tcp", address)
		}

		if err == nil {
			return nil
		}
	}
	return err
}

// Close closes the LDAP connection
func (ldap *Auth) Close() {
	ldap.connection.Close()
}

// Login logs in the user
func (ldap *Auth) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo, error,
) {

	// perform initial authentication
	if err := ldap.authenticate(query.Username, query.Password); err != nil {
		return nil, err
	}

	// find user entry & attributes
	user, err := ldap.searchUser(query.Username)
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

	result, err := ldap.ExtractGrafanaUser(user)
	if err != nil {
		return nil, err
	}

	return result, nil
}

// Add adds user to LDAP
func (ldap *Auth) Add(dn string, values map[string][]string) error {
	err := ldap.authenticate(ldap.server.BindDN, ldap.server.BindPassword)
	if err != nil {
		return err
	}

	attributes := make([]LDAP.Attribute, 0)
	for key, value := range values {
		attributes = append(attributes, LDAP.Attribute{
			Type: key,
			Vals: value,
		})
	}

	request := &LDAP.AddRequest{
		DN:         dn,
		Attributes: attributes,
	}

	err = ldap.connection.Add(request)
	if err != nil {
		return err
	}

	return nil
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

// ExtractGrafanaUser extracts external user info from LDAP user
func (ldap *Auth) ExtractGrafanaUser(user *UserInfo) (*models.ExternalUserInfo, error) {
	result := ldap.buildGrafanaUser(user)
	if err := ldap.validateGrafanaUser(result); err != nil {
		return nil, err
	}

	return result, nil
}

// validateGrafanaUser validates user access.
// If there are no ldap group mappings access is true
// otherwise a single group must match
func (ldap *Auth) validateGrafanaUser(user *models.ExternalUserInfo) error {
	if len(ldap.server.Groups) > 0 && len(user.OrgRoles) < 1 {
		ldap.log.Error(
			"user does not belong in any of the specified LDAP groups",
			"username", user.Login,
			"groups", user.Groups,
		)
		return ErrInvalidCredentials
	}

	return nil
}

func (ldap *Auth) buildGrafanaUser(user *UserInfo) *models.ExternalUserInfo {
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

func (auth *Auth) authenticate(username, userPassword string) error {
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

func (auth *Auth) searchUser(username string) (*UserInfo, error) {
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
		memberOf, err = auth.getMemberOf(searchResult)
		if err != nil {
			return nil, err
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

// getMemberOf use this function when POSIX LDAP schema does not support memberOf, so it manually search the groups
func (ldap *Auth) getMemberOf(searchResult *LDAP.SearchResult) ([]string, error) {
	var memberOf []string

	for _, groupSearchBase := range ldap.server.GroupSearchBaseDNs {
		var filterReplace string
		if ldap.server.GroupSearchFilterUserAttribute == "" {
			filterReplace = getLdapAttr(ldap.server.Attr.Username, searchResult)
		} else {
			filterReplace = getLdapAttr(ldap.server.GroupSearchFilterUserAttribute, searchResult)
		}

		filter := strings.Replace(
			ldap.server.GroupSearchFilter, "%s",
			LDAP.EscapeFilter(filterReplace),
			-1,
		)

		ldap.log.Info("Searching for user's groups", "filter", filter)

		// support old way of reading settings
		groupIDAttribute := ldap.server.Attr.MemberOf
		// but prefer dn attribute if default settings are used
		if groupIDAttribute == "" || groupIDAttribute == "memberOf" {
			groupIDAttribute = "dn"
		}

		groupSearchReq := LDAP.SearchRequest{
			BaseDN:       groupSearchBase,
			Scope:        LDAP.ScopeWholeSubtree,
			DerefAliases: LDAP.NeverDerefAliases,
			Attributes:   []string{groupIDAttribute},
			Filter:       filter,
		}

		groupSearchResult, err := ldap.connection.Search(&groupSearchReq)
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

func (ldap *Auth) serializeUsers(users *LDAP.SearchResult) []*models.ExternalUserInfo {
	var serialized []*models.ExternalUserInfo

	for index := range users.Entries {
		serialize := ldap.buildGrafanaUser(&UserInfo{
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
