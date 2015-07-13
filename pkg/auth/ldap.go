package auth

import (
	"errors"
	"fmt"

	"github.com/go-ldap/ldap"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	setting.LdapServers = []*setting.LdapServerConf{
		&setting.LdapServerConf{
			UseSSL: false,
			Host:   "127.0.0.1",
			Port:   "389",
			BindDN: "cn=%s,dc=grafana,dc=org",
		},
	}
}

type ldapAuther struct {
	server *setting.LdapServerConf
	conn   *ldap.Conn
}

func NewLdapAuthenticator(server *setting.LdapServerConf) *ldapAuther {
	return &ldapAuther{
		server: server,
	}
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

	bindPath := fmt.Sprintf(a.server.BindDN, query.Username)

	if err := a.conn.Bind(bindPath, query.Password); err != nil {
		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	searchReq := ldap.SearchRequest{
		BaseDN:       "dc=grafana,dc=org",
		Scope:        ldap.ScopeWholeSubtree,
		DerefAliases: ldap.NeverDerefAliases,
		Attributes:   []string{"sn", "email", "givenName", "memberOf"},
		Filter:       fmt.Sprintf("(cn=%s)", query.Username),
	}

	result, err := a.conn.Search(&searchReq)
	if err != nil {
		return err
	}

	if len(result.Entries) == 0 {
		return errors.New("Ldap search matched no entry, please review your filter setting.")
	}

	if len(result.Entries) > 1 {
		return errors.New("Ldap search matched mopre than one entry, please review your filter setting")
	}

	surname := getLdapAttr("sn", result)
	givenName := getLdapAttr("givenName", result)
	email := getLdapAttr("email", result)
	memberOf := getLdapAttrArray("memberOf", result)

	log.Info("Surname: %s", surname)
	log.Info("givenName: %s", givenName)
	log.Info("email: %s", email)
	log.Info("memberOf: %s", memberOf)

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: query.Username}
	err = bus.Dispatch(&userQuery)

	if err != nil {
		if err == m.ErrUserNotFound {
		}
		return err
	}

	query.User = userQuery.Result

	return nil
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
