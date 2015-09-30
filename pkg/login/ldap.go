package login

import (
	"crypto/tls"
	"errors"
	"fmt"
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
	address := fmt.Sprintf("%s:%d", a.server.Host, a.server.Port)
	var err error
	if a.server.UseSSL {
		tlsCfg := &tls.Config{
			InsecureSkipVerify: a.server.SkipVerifySSL,
			ServerName:         a.server.Host,
		}
		a.conn, err = ldap.DialTLS("tcp", address, tlsCfg)
	} else {
		a.conn, err = ldap.Dial("tcp", address)
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

		if a.server.SearchInGroups {
			for _, ldapGroup := range a.server.LdapGroups {
				// skip obviously incorrect group for search user
				if ldapGroup.GroupDN == "*" {
					continue
				}
				if err := a.searchUserInGroup(ldapUser, ldapGroup.GroupDN); err != nil {
					return err
				}
			}
		}

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

func (a *ldapAuther) syncOrgRoles(user *m.User, ldapUser *ldapUserInfo) error {
	if len(a.server.LdapGroups) == 0 {
		return nil
	}

	orgsQuery := m.GetUserOrgListQuery{UserId: user.Id}
	if err := bus.Dispatch(&orgsQuery); err != nil {
		return err
	}

	// update or remove org roles
	for _, org := range orgsQuery.Result {
		match := false

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

		match := false
		for _, org := range orgsQuery.Result {
			if group.OrgId == org.OrgId {
				match = true
				break
			}
		}

		if !match {
			// add role
			cmd := m.AddOrgUserCommand{UserId: user.Id, Role: group.OrgRole, OrgId: group.OrgId}
			if err := bus.Dispatch(&cmd); err != nil {
				return err
			}
			break
		}
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

	return &ldapUserInfo{
		DN:        searchResult.Entries[0].DN,
		LastName:  getLdapAttr(a.server.Attr.Surname, searchResult),
		FirstName: getLdapAttr(a.server.Attr.Name, searchResult),
		Username:  getLdapAttr(a.server.Attr.Username, searchResult),
		Email:     getLdapAttr(a.server.Attr.Email, searchResult),
		MemberOf:  getLdapAttrArray(a.server.Attr.MemberOf, searchResult),
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

func (a *ldapAuther) searchUserInGroup(ldapUser *ldapUserInfo, ldapGroupDN string) error {
	var searchResult *ldap.SearchResult
	var err error

	searchReq := ldap.SearchRequest{
		BaseDN:       ldapGroupDN,
		Scope:        ldap.ScopeWholeSubtree,
		DerefAliases: ldap.NeverDerefAliases,
		Filter:       fmt.Sprintf("(member=%s)", ldapUser.DN),
	}

	if searchResult, err = a.conn.Search(&searchReq); err != nil {
		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapCfg.VerboseLogging {
				log.Warn("Ldap Auth: error while search user %s in LDAP group %s. %s", ldapUser.DN, ldapGroupDN, ldapErr.Error())
			}
		}
	}

	for _, group := range searchResult.Entries {
		if !ldapUser.isMemberOf(group.DN) {
			ldapUser.MemberOf = append(ldapUser.MemberOf, group.DN)
		}
	}

	return nil
}

func createUserFromLdapInfo() error {
	return nil
}
