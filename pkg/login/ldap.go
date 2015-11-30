package login

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io/ioutil"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"github.com/go-ldap/ldap"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

type ldapAuther struct {
	server            *LdapServerConf
	conn              *ldap.Conn
	requireSecondBind bool
}

func NewLdapAuthenticator(server *LdapServerConf) *ldapAuther {
	return &ldapAuther{server: server}
}

func (a *ldapAuther) Dial() error {
	var err error
	var certPool *x509.CertPool
	if a.server.RootCACert != "" {
		certPool := x509.NewCertPool()
		for _, caCertFile := range strings.Split(a.server.RootCACert, " ") {
			if pem, err := ioutil.ReadFile(caCertFile); err != nil {
				return err
			} else {
				if !certPool.AppendCertsFromPEM(pem) {
					return errors.New("Failed to append CA certficate " + caCertFile)
				}
			}
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
			a.conn, err = ldap.DialTLS("tcp", address, tlsCfg)
		} else {
			a.conn, err = ldap.Dial("tcp", address)
		}

		if err == nil {
			return nil
		}
	}
	return err
}

func (a *ldapAuther) login(query *LoginUserQuery) error {
	if err := a.Dial(); err != nil {
		return err
	}
	defer a.conn.Close()

	// perform initial authentication
	if err := a.initialBind(query.Username, query.Password); err != nil {
		return err
	}

	// find user entry & attributes
	if ldapUser, err := a.searchForUser(query.Username); err != nil {
		return err
	} else {
		if ldapCfg.VerboseLogging {
			log.Info("Ldap User Info: %s", spew.Sdump(ldapUser))
		}

		// check if a second user bind is needed
		if a.requireSecondBind {
			if err := a.secondBind(ldapUser, query.Password); err != nil {
				return err
			}
		}

		if grafanaUser, err := a.getGrafanaUserFor(ldapUser); err != nil {
			return err
		} else {
			// sync user details
			if err := a.syncUserInfo(grafanaUser, ldapUser); err != nil {
				return err
			}
			// sync org roles
			if err := a.syncOrgRoles(grafanaUser, ldapUser); err != nil {
				return err
			}
			query.User = grafanaUser
			return nil
		}
	}
}

func (a *ldapAuther) getGrafanaUserFor(ldapUser *ldapUserInfo) (*m.User, error) {
	// validate that the user has access
	// if there are no ldap group mappings access is true
	// otherwise a single group must match
	access := len(a.server.LdapGroups) == 0
	for _, ldapGroup := range a.server.LdapGroups {
		if ldapUser.isMemberOf(ldapGroup.GroupDN) {
			access = true
			break
		}
	}

	if !access {
		log.Info("Ldap Auth: user %s does not belong in any of the specified ldap groups, ldapUser groups: %v", ldapUser.Username, ldapUser.MemberOf)
		return nil, ErrInvalidCredentials
	}

	// get user from grafana db
	userQuery := m.GetUserByLoginQuery{LoginOrEmail: ldapUser.Username}
	if err := bus.Dispatch(&userQuery); err != nil {
		if err == m.ErrUserNotFound {
			return a.createGrafanaUser(ldapUser)
		} else {
			return nil, err
		}
	}

	return userQuery.Result, nil
}

func (a *ldapAuther) createGrafanaUser(ldapUser *ldapUserInfo) (*m.User, error) {
	cmd := m.CreateUserCommand{
		Login: ldapUser.Username,
		Email: ldapUser.Email,
		Name:  fmt.Sprintf("%s %s", ldapUser.FirstName, ldapUser.LastName),
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return nil, err
	}

	return &cmd.Result, nil
}

func (a *ldapAuther) syncUserInfo(user *m.User, ldapUser *ldapUserInfo) error {
	var name = fmt.Sprintf("%s %s", ldapUser.FirstName, ldapUser.LastName)
	if user.Email == ldapUser.Email && user.Name == name {
		return nil
	}

	log.Info("Ldap: Syncing user info %s", ldapUser.Username)
	updateCmd := m.UpdateUserCommand{}
	updateCmd.UserId = user.Id
	updateCmd.Login = user.Login
	updateCmd.Email = ldapUser.Email
	updateCmd.Name = fmt.Sprintf("%s %s", ldapUser.FirstName, ldapUser.LastName)
	return bus.Dispatch(&updateCmd)
}

func (a *ldapAuther) syncOrgRoles(user *m.User, ldapUser *ldapUserInfo) error {
	if len(a.server.LdapGroups) == 0 {
		return nil
	}

	orgsQuery := m.GetUserOrgListQuery{UserId: user.Id}
	if err := bus.Dispatch(&orgsQuery); err != nil {
		return err
	}

	handledOrgIds := map[int64]bool{}

	// update or remove org roles
	for _, org := range orgsQuery.Result {
		match := false
		handledOrgIds[org.OrgId] = true

		for _, group := range a.server.LdapGroups {
			if org.OrgId != group.OrgId {
				continue
			}

			if ldapUser.isMemberOf(group.GroupDN) {
				match = true
				if org.Role != group.OrgRole {
					// update role
					cmd := m.UpdateOrgUserCommand{OrgId: org.OrgId, UserId: user.Id, Role: group.OrgRole}
					if err := bus.Dispatch(&cmd); err != nil {
						return err
					}
				}
				// ignore subsequent ldap group mapping matches
				break
			}
		}

		// remove role if no mappings match
		if !match {
			cmd := m.RemoveOrgUserCommand{OrgId: org.OrgId, UserId: user.Id}
			if err := bus.Dispatch(&cmd); err != nil {
				return err
			}
		}
	}

	// add missing org roles
	for _, group := range a.server.LdapGroups {
		if !ldapUser.isMemberOf(group.GroupDN) {
			continue
		}

		if _, exists := handledOrgIds[group.OrgId]; exists {
			continue
		}

		// add role
		cmd := m.AddOrgUserCommand{UserId: user.Id, Role: group.OrgRole, OrgId: group.OrgId}
		if err := bus.Dispatch(&cmd); err != nil {
			return err
		}

		// mark this group has handled so we do not process it again
		handledOrgIds[group.OrgId] = true
	}

	return nil
}

func (a *ldapAuther) secondBind(ldapUser *ldapUserInfo, userPassword string) error {
	if err := a.conn.Bind(ldapUser.DN, userPassword); err != nil {
		if ldapCfg.VerboseLogging {
			log.Info("LDAP second bind failed, %v", err)
		}

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

	if err := a.conn.Bind(bindPath, userPassword); err != nil {
		if ldapCfg.VerboseLogging {
			log.Info("LDAP initial bind failed, %v", err)
		}

		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	return nil
}

func (a *ldapAuther) searchForUser(username string) (*ldapUserInfo, error) {
	var searchResult *ldap.SearchResult
	var err error

	for _, searchBase := range a.server.SearchBaseDNs {
		searchReq := ldap.SearchRequest{
			BaseDN:       searchBase,
			Scope:        ldap.ScopeWholeSubtree,
			DerefAliases: ldap.NeverDerefAliases,
			Attributes: []string{
				a.server.Attr.Username,
				a.server.Attr.Surname,
				a.server.Attr.Email,
				a.server.Attr.Name,
				a.server.Attr.MemberOf,
			},
			Filter: strings.Replace(a.server.SearchFilter, "%s", username, -1),
		}

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
			filter := strings.Replace(a.server.GroupSearchFilter, "%s", username, -1)

			if ldapCfg.VerboseLogging {
				log.Info("LDAP: Searching for user's groups: %s", filter)
			}

			groupSearchReq := ldap.SearchRequest{
				BaseDN:       groupSearchBase,
				Scope:        ldap.ScopeWholeSubtree,
				DerefAliases: ldap.NeverDerefAliases,
				Attributes: []string{
					// Here MemberOf would be the thing that identifies the group, which is normally 'cn'
					a.server.Attr.MemberOf,
				},
				Filter: filter,
			}

			groupSearchResult, err = a.conn.Search(&groupSearchReq)
			if err != nil {
				return nil, err
			}

			if len(groupSearchResult.Entries) > 0 {
				for i := range groupSearchResult.Entries {
					memberOf = append(memberOf, getLdapAttrN(a.server.Attr.MemberOf, groupSearchResult, i))
				}
				break
			}
		}
	}

	return &ldapUserInfo{
		DN:        searchResult.Entries[0].DN,
		LastName:  getLdapAttr(a.server.Attr.Surname, searchResult),
		FirstName: getLdapAttr(a.server.Attr.Name, searchResult),
		Username:  getLdapAttr(a.server.Attr.Username, searchResult),
		Email:     getLdapAttr(a.server.Attr.Email, searchResult),
		MemberOf:  memberOf,
	}, nil
}

func getLdapAttrN(name string, result *ldap.SearchResult, n int) string {
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

func createUserFromLdapInfo() error {
	return nil
}
