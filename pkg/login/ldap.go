package login

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io/ioutil"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/ldap.v3"
)

type ILdapConn interface {
	Bind(username, password string) error
	UnauthenticatedBind(username string) error
	Search(*ldap.SearchRequest) (*ldap.SearchResult, error)
	StartTLS(*tls.Config) error
	Close()
}

type ILdapAuther interface {
	Login(query *m.LoginUserQuery) error
	SyncUser(query *m.LoginUserQuery) error
	GetGrafanaUserFor(ctx *m.ReqContext, ldapUser *LdapUserInfo) (*m.User, error)
}

type ldapAuther struct {
	server            *LdapServerConf
	conn              ILdapConn
	requireSecondBind bool
	log               log.Logger
}

var NewLdapAuthenticator = func(server *LdapServerConf) ILdapAuther {
	return &ldapAuther{server: server, log: log.New("ldap")}
}

var ldapDial = func(network, addr string) (ILdapConn, error) {
	return ldap.Dial(network, addr)
}

func (a *ldapAuther) Dial() error {
	var err error
	var certPool *x509.CertPool
	if a.server.RootCACert != "" {
		certPool = x509.NewCertPool()
		for _, caCertFile := range strings.Split(a.server.RootCACert, " ") {
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
	if a.server.ClientCert != "" && a.server.ClientKey != "" {
		clientCert, err = tls.LoadX509KeyPair(a.server.ClientCert, a.server.ClientKey)
		if err != nil {
			return err
		}
	}
	for _, host := range strings.Split(a.server.Host, " ") {
		address := fmt.Sprintf("%s:%d", host, a.server.Port)
		if a.server.UseSSL {
			tlsCfg := &tls.Config{
				InsecureSkipVerify: a.server.SkipVerifySSL,
				ServerName:         host,
				RootCAs:            certPool,
			}
			if len(clientCert.Certificate) > 0 {
				tlsCfg.Certificates = append(tlsCfg.Certificates, clientCert)
			}
			if a.server.StartTLS {
				a.conn, err = ldap.Dial("tcp", address)
				if err == nil {
					if err = a.conn.StartTLS(tlsCfg); err == nil {
						return nil
					}
				}
			} else {
				a.conn, err = ldap.DialTLS("tcp", address, tlsCfg)
			}
		} else {
			a.conn, err = ldapDial("tcp", address)
		}

		if err == nil {
			return nil
		}
	}
	return err
}

func (a *ldapAuther) Login(query *m.LoginUserQuery) error {
	// connect to ldap server
	if err := a.Dial(); err != nil {
		return err
	}
	defer a.conn.Close()

	// perform initial authentication
	if err := a.initialBind(query.Username, query.Password); err != nil {
		return err
	}

	// find user entry & attributes
	ldapUser, err := a.searchForUser(query.Username)
	if err != nil {
		return err
	}

	a.log.Debug("Ldap User found", "info", spew.Sdump(ldapUser))

	// check if a second user bind is needed
	if a.requireSecondBind {
		err = a.secondBind(ldapUser, query.Password)
		if err != nil {
			return err
		}
	}

	grafanaUser, err := a.GetGrafanaUserFor(query.ReqContext, ldapUser)
	if err != nil {
		return err
	}

	query.User = grafanaUser
	return nil
}

func (a *ldapAuther) SyncUser(query *m.LoginUserQuery) error {
	// connect to ldap server
	err := a.Dial()
	if err != nil {
		return err
	}
	defer a.conn.Close()

	err = a.serverBind()
	if err != nil {
		return err
	}

	// find user entry & attributes
	ldapUser, err := a.searchForUser(query.Username)
	if err != nil {
		a.log.Error("Failed searching for user in ldap", "error", err)
		return err
	}

	a.log.Debug("Ldap User found", "info", spew.Sdump(ldapUser))

	grafanaUser, err := a.GetGrafanaUserFor(query.ReqContext, ldapUser)
	if err != nil {
		return err
	}

	query.User = grafanaUser
	return nil
}

func (a *ldapAuther) GetGrafanaUserFor(ctx *m.ReqContext, ldapUser *LdapUserInfo) (*m.User, error) {
	extUser := &m.ExternalUserInfo{
		AuthModule: "ldap",
		AuthId:     ldapUser.DN,
		Name:       fmt.Sprintf("%s %s", ldapUser.FirstName, ldapUser.LastName),
		Login:      ldapUser.Username,
		Email:      ldapUser.Email,
		Groups:     ldapUser.MemberOf,
		OrgRoles:   map[int64]m.RoleType{},
	}

	for _, group := range a.server.LdapGroups {
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
	if len(a.server.LdapGroups) > 0 && len(extUser.OrgRoles) < 1 {
		a.log.Info(
			"Ldap Auth: user does not belong in any of the specified ldap groups",
			"username", ldapUser.Username,
			"groups", ldapUser.MemberOf)
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

func (a *ldapAuther) serverBind() error {
	bindFn := func() error {
		return a.conn.Bind(a.server.BindDN, a.server.BindPassword)
	}

	if a.server.BindPassword == "" {
		bindFn = func() error {
			return a.conn.UnauthenticatedBind(a.server.BindDN)
		}
	}

	// bind_dn and bind_password to bind
	if err := bindFn(); err != nil {
		a.log.Info("LDAP initial bind failed, %v", err)

		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	return nil
}

func (a *ldapAuther) secondBind(ldapUser *LdapUserInfo, userPassword string) error {
	if err := a.conn.Bind(ldapUser.DN, userPassword); err != nil {
		a.log.Info("Second bind failed", "error", err)

		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	return nil
}

func (a *ldapAuther) initialBind(username, userPassword string) error {
	if a.server.BindPassword != "" || a.server.BindDN == "" {
		userPassword = a.server.BindPassword
		a.requireSecondBind = true
	}

	bindPath := a.server.BindDN
	if strings.Contains(bindPath, "%s") {
		bindPath = fmt.Sprintf(a.server.BindDN, username)
	}

	bindFn := func() error {
		return a.conn.Bind(bindPath, userPassword)
	}

	if userPassword == "" {
		bindFn = func() error {
			return a.conn.UnauthenticatedBind(bindPath)
		}
	}

	if err := bindFn(); err != nil {
		a.log.Info("Initial bind failed", "error", err)

		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	return nil
}

func appendIfNotEmpty(slice []string, values ...string) []string {
	for _, v := range values {
		if v != "" {
			slice = append(slice, v)
		}
	}
	return slice
}

func (a *ldapAuther) searchForUser(username string) (*LdapUserInfo, error) {
	var searchResult *ldap.SearchResult
	var err error

	for _, searchBase := range a.server.SearchBaseDNs {
		attributes := make([]string, 0)
		inputs := a.server.Attr
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
			Filter:       strings.Replace(a.server.SearchFilter, "%s", ldap.EscapeFilter(username), -1),
		}

		a.log.Debug("Ldap Search For User Request", "info", spew.Sdump(searchReq))

		searchResult, err = a.conn.Search(&searchReq)
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
	if a.server.GroupSearchFilter == "" {
		memberOf = getLdapAttrArray(a.server.Attr.MemberOf, searchResult)
	} else {
		// If we are using a POSIX LDAP schema it won't support memberOf, so we manually search the groups
		var groupSearchResult *ldap.SearchResult
		for _, groupSearchBase := range a.server.GroupSearchBaseDNs {
			var filter_replace string
			if a.server.GroupSearchFilterUserAttribute == "" {
				filter_replace = getLdapAttr(a.server.Attr.Username, searchResult)
			} else {
				filter_replace = getLdapAttr(a.server.GroupSearchFilterUserAttribute, searchResult)
			}

			filter := strings.Replace(a.server.GroupSearchFilter, "%s", ldap.EscapeFilter(filter_replace), -1)

			a.log.Info("Searching for user's groups", "filter", filter)

			// support old way of reading settings
			groupIdAttribute := a.server.Attr.MemberOf
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

			groupSearchResult, err = a.conn.Search(&groupSearchReq)
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

	return &LdapUserInfo{
		DN:        searchResult.Entries[0].DN,
		LastName:  getLdapAttr(a.server.Attr.Surname, searchResult),
		FirstName: getLdapAttr(a.server.Attr.Name, searchResult),
		Username:  getLdapAttr(a.server.Attr.Username, searchResult),
		Email:     getLdapAttr(a.server.Attr.Email, searchResult),
		MemberOf:  memberOf,
	}, nil
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

func getLdapAttr(name string, result *ldap.SearchResult) string {
	return getLdapAttrN(name, result, 0)
}

func getLdapAttrArray(name string, result *ldap.SearchResult) []string {
	for _, attr := range result.Entries[0].Attributes {
		if attr.Name == name {
			return attr.Values
		}
	}
	return []string{}
}
