package auth

import (
	"errors"
	"fmt"

	"github.com/go-ldap/ldap"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

var ldapServers []*LdapServerConf

func init() {
	ldapServers = []*LdapServerConf{
		{
			UseSSL:        false,
			Host:          "127.0.0.1",
			Port:          "389",
			BindDN:        "cn=%s,dc=grafana,dc=org",
			AttrName:      "givenName",
			AttrSurname:   "sn",
			AttrUsername:  "cn",
			AttrMemberOf:  "memberOf",
			AttrEmail:     "email",
			SearchFilter:  "(cn=%s)",
			SearchBaseDNs: []string{"dc=grafana,dc=org"},
			LdapGroups: []*LdapGroupToOrgRole{
				{GroupDN: "cn=users,dc=grafana,dc=org", OrgId: 1, OrgRole: m.ROLE_VIEWER},
			},
		},
	}
}

type ldapAuther struct {
	server *LdapServerConf
	conn   *ldap.Conn
}

func NewLdapAuthenticator(server *LdapServerConf) *ldapAuther {
	return &ldapAuther{server: server}
}

func (a *ldapAuther) Dial() error {
	address := fmt.Sprintf("%s:%s", a.server.Host, a.server.Port)
	var err error
	if a.server.UseSSL {
		a.conn, err = ldap.DialTLS("tcp", address, nil)
	} else {
		a.conn, err = ldap.Dial("tcp", address)
	}

	return err
}

func (a *ldapAuther) login(query *AuthenticateUserQuery) error {
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
		log.Info("Surname: %s", ldapUser.LastName)
		log.Info("givenName: %s", ldapUser.FirstName)
		log.Info("email: %s", ldapUser.Email)
		log.Info("memberOf: %s", ldapUser.MemberOf)

		if grafanaUser, err := a.getGrafanaUserFor(ldapUser); err != nil {
			return err
		} else {
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
		}
	}

	if !access {
		log.Info("Ldap Auth: user %s does not belong in any of the specified ldap groups", ldapUser.Username)
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

func (a *ldapAuther) syncOrgRoles(user *m.User, ldapUser *ldapUserInfo) error {
	if len(a.server.LdapGroups) == 0 {
		return nil
	}

	orgsQuery := m.GetUserOrgListQuery{UserId: user.Id}
	if err := bus.Dispatch(&orgsQuery); err != nil {
		return err
	}

	// remove or update org roles
	for _, org := range orgsQuery.Result {
		for _, group := range a.server.LdapGroups {
			if org.OrgId != group.OrgId {
				continue
			}

			if ldapUser.isMemberOf(group.GroupDN) {
				if org.Role != group.OrgRole {
					// update role
					cmd := m.UpdateOrgUserCommand{OrgId: org.OrgId, UserId: user.Id, Role: group.OrgRole}
					if err := bus.Dispatch(&cmd); err != nil {
						return err
					}
				}
			} else {
				// remove role
				cmd := m.RemoveOrgUserCommand{OrgId: org.OrgId, UserId: user.Id}
				if err := bus.Dispatch(&cmd); err != nil {
					return err
				}
			}
		}
	}

	// add missing org roles
	for _, group := range a.server.LdapGroups {
		if !ldapUser.isMemberOf(group.GroupDN) {
			continue
		}

		match := false
		for _, org := range orgsQuery.Result {
			if group.OrgId == org.OrgId {
				match = true
			}
		}

		if !match {
			// add role
			cmd := m.AddOrgUserCommand{UserId: user.Id, Role: group.OrgRole, OrgId: group.OrgId}
			if err := bus.Dispatch(&cmd); err != nil {
				return err
			}
		}
	}

	return nil
}

func (a *ldapAuther) initialBind(username, userPassword string) error {
	if a.server.BindPassword != "" {
		userPassword = a.server.BindPassword
	}

	bindPath := fmt.Sprintf(a.server.BindDN, username)

	if err := a.conn.Bind(bindPath, userPassword); err != nil {
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
				a.server.AttrUsername,
				a.server.AttrSurname,
				a.server.AttrEmail,
				a.server.AttrName,
				a.server.AttrMemberOf,
			},
			Filter: fmt.Sprintf(a.server.SearchFilter, username),
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
		return nil, errors.New("Ldap search matched no entry, please review your filter setting.")
	}

	if len(searchResult.Entries) > 1 {
		return nil, errors.New("Ldap search matched mopre than one entry, please review your filter setting")
	}

	return &ldapUserInfo{
		LastName:  getLdapAttr(a.server.AttrSurname, searchResult),
		FirstName: getLdapAttr(a.server.AttrName, searchResult),
		Username:  getLdapAttr(a.server.AttrUsername, searchResult),
		Email:     getLdapAttr(a.server.AttrEmail, searchResult),
		MemberOf:  getLdapAttrArray(a.server.AttrMemberOf, searchResult),
	}, nil
}

func getLdapAttr(name string, result *ldap.SearchResult) string {
	for _, attr := range result.Entries[0].Attributes {
		if attr.Name == name {
			if len(attr.Values) > 0 {
				return attr.Values[0]
			}
		}
	}
	return ""
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
