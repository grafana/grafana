package ldap

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io/ioutil"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

// IConnection is interface for LDAP connection manipulation
type IConnection interface {
	Bind(username, password string) error
	UnauthenticatedBind(username string) error
	Search(*ldap.SearchRequest) (*ldap.SearchResult, error)
	StartTLS(*tls.Config) error
	Close()
}

// IAuth is interface for LDAP authorization
type IAuth interface {
	Login(query *m.LoginUserQuery) error
	SyncUser(query *m.LoginUserQuery) error
	GetGrafanaUserFor(ctx *m.ReqContext, ldapUser *UserInfo) (*m.User, error)
	Users() ([]*UserInfo, error)
}

// Auth is basic struct of LDAP authorization
type Auth struct {
	server            *ServerConfig
	conn              IConnection
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
				auth.conn, err = dial("tcp", address)
				if err == nil {
					if err = auth.conn.StartTLS(tlsCfg); err == nil {
						return nil
					}
				}
			} else {
				auth.conn, err = ldap.DialTLS("tcp", address, tlsCfg)
			}
		} else {
			auth.conn, err = dial("tcp", address)
		}

		if err == nil {
			return nil
		}
	}
	return err
}

// Login logs in the user
func (auth *Auth) Login(query *m.LoginUserQuery) error {
	// connect to ldap server
	if err := auth.Dial(); err != nil {
		return err
	}
	defer auth.conn.Close()

	// perform initial authentication
	if err := auth.initialBind(query.Username, query.Password); err != nil {
		return err
	}

	// find user entry & attributes
	ldapUser, err := auth.searchForUser(query.Username)
	if err != nil {
		return err
	}

	auth.log.Debug("Ldap User found", "info", spew.Sdump(ldapUser))

	// check if a second user bind is needed
	if auth.requireSecondBind {
		err = auth.secondBind(ldapUser, query.Password)
		if err != nil {
			return err
		}
	}

	grafanaUser, err := auth.GetGrafanaUserFor(query.ReqContext, ldapUser)
	if err != nil {
		return err
	}

	query.User = grafanaUser
	return nil
}

// SyncUser syncs user with Grafana
func (auth *Auth) SyncUser(query *m.LoginUserQuery) error {
	// connect to ldap server
	err := auth.Dial()
	if err != nil {
		return err
	}
	defer auth.conn.Close()

	err = auth.serverBind()
	if err != nil {
		return err
	}

	// find user entry & attributes
	ldapUser, err := auth.searchForUser(query.Username)
	if err != nil {
		auth.log.Error("Failed searching for user in ldap", "error", err)
		return err
	}

	auth.log.Debug("Ldap User found", "info", spew.Sdump(ldapUser))

	grafanaUser, err := auth.GetGrafanaUserFor(query.ReqContext, ldapUser)
	if err != nil {
		return err
	}

	query.User = grafanaUser
	return nil
}

func (auth *Auth) GetGrafanaUserFor(ctx *m.ReqContext, ldapUser *UserInfo) (*m.User, error) {
	extUser := &m.ExternalUserInfo{
		AuthModule: "ldap",
		AuthId:     ldapUser.DN,
		Name:       fmt.Sprintf("%s %s", ldapUser.FirstName, ldapUser.LastName),
		Login:      ldapUser.Username,
		Email:      ldapUser.Email,
		Groups:     ldapUser.MemberOf,
		OrgRoles:   map[int64]m.RoleType{},
	}

	for _, group := range auth.server.LdapGroups {
		// only use the first match for each org
		if extUser.OrgRoles[group.OrgId] != "" {
			continue
		}

		if ldapUser.isMemberOf(group.GroupDN) {
			extUser.OrgRoles[group.OrgId] = group.OrgRole
			if extUser.IsGrafanaAdmin == nil || !*extUser.IsGrafanaAdmin {
				extUser.IsGrafanaAdmin = group.IsGrafanaAdmin
			}
		}
	}

	// validate that the user has access
	// if there are no ldap group mappings access is true
	// otherwise a single group must match
	if len(auth.server.LdapGroups) > 0 && len(extUser.OrgRoles) < 1 {
		auth.log.Info(
			"Ldap Auth: user does not belong in any of the specified ldap groups",
			"username", ldapUser.Username,
			"groups", ldapUser.MemberOf,
		)
		return nil, ErrInvalidCredentials
	}

	// add/update user in grafana
	upsertUserCmd := &m.UpsertUserCommand{
		ReqContext:    ctx,
		ExternalUser:  extUser,
		SignupAllowed: setting.LdapAllowSignup,
	}

	err := bus.Dispatch(upsertUserCmd)
	if err != nil {
		return nil, err
	}

	return upsertUserCmd.Result, nil
}

func (auth *Auth) serverBind() error {
	bindFn := func() error {
		return auth.conn.Bind(auth.server.BindDN, auth.server.BindPassword)
	}

	if auth.server.BindPassword == "" {
		bindFn = func() error {
			return auth.conn.UnauthenticatedBind(auth.server.BindDN)
		}
	}

	// bind_dn and bind_password to bind
	if err := bindFn(); err != nil {
		auth.log.Info("LDAP initial bind failed, %v", err)

		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	return nil
}

func (auth *Auth) secondBind(ldapUser *UserInfo, userPassword string) error {
	if err := auth.conn.Bind(ldapUser.DN, userPassword); err != nil {
		auth.log.Info("Second bind failed", "error", err)

		if ldapErr, ok := err.(*ldap.Error); ok {
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
		return auth.conn.Bind(bindPath, userPassword)
	}

	if userPassword == "" {
		bindFn = func() error {
			return auth.conn.UnauthenticatedBind(bindPath)
		}
	}

	if err := bindFn(); err != nil {
		auth.log.Info("Initial bind failed", "error", err)

		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	return nil
}

func (auth *Auth) searchForUser(username string) (*UserInfo, error) {
	var searchResult *ldap.SearchResult
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

		searchReq := ldap.SearchRequest{
			BaseDN:       searchBase,
			Scope:        ldap.ScopeWholeSubtree,
			DerefAliases: ldap.NeverDerefAliases,
			Attributes:   attributes,
			Filter:       strings.Replace(auth.server.SearchFilter, "%s", ldap.EscapeFilter(username), -1),
		}

		auth.log.Debug("Ldap Search For User Request", "info", spew.Sdump(searchReq))

		searchResult, err = auth.conn.Search(&searchReq)
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
		var groupSearchResult *ldap.SearchResult
		for _, groupSearchBase := range auth.server.GroupSearchBaseDNs {
			var filter_replace string
			if auth.server.GroupSearchFilterUserAttribute == "" {
				filter_replace = getLdapAttr(auth.server.Attr.Username, searchResult)
			} else {
				filter_replace = getLdapAttr(auth.server.GroupSearchFilterUserAttribute, searchResult)
			}

			filter := strings.Replace(auth.server.GroupSearchFilter, "%s", ldap.EscapeFilter(filter_replace), -1)

			auth.log.Info("Searching for user's groups", "filter", filter)

			// support old way of reading settings
			groupIdAttribute := auth.server.Attr.MemberOf
			// but prefer dn attribute if default settings are used
			if groupIdAttribute == "" || groupIdAttribute == "memberOf" {
				groupIdAttribute = "dn"
			}

			groupSearchReq := ldap.SearchRequest{
				BaseDN:       groupSearchBase,
				Scope:        ldap.ScopeWholeSubtree,
				DerefAliases: ldap.NeverDerefAliases,
				Attributes:   []string{groupIdAttribute},
				Filter:       filter,
			}

			groupSearchResult, err = auth.conn.Search(&groupSearchReq)
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
