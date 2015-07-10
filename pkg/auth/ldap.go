package auth

import (
	"fmt"
	"net/url"

	"github.com/go-ldap/ldap"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func loginUsingLdap(query *AuthenticateUserQuery) error {
	url, err := url.Parse(setting.LdapHosts[0])
	if err != nil {
		return err
	}

	conn, err := ldap.Dial("tcp", url.Host)
	if err != nil {
		return err
	}

	defer conn.Close()

	bindPath := fmt.Sprintf(setting.LdapBindPath, query.Username)
	err = conn.Bind(bindPath, query.Password)

	if err != nil {
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
		Attributes:   []string{"cn", "sn", "email"},
		Filter:       fmt.Sprintf("(cn=%s)", query.Username),
	}

	result, err := conn.Search(&searchReq)
	if err != nil {
		return err
	}

	log.Info("Search result: %v, error: %v", result, err)

	for _, entry := range result.Entries {
		log.Info("cn: %s", entry.Attributes[0].Values[0])
		log.Info("email: %s", entry.Attributes[2].Values[0])
	}

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

func createUserFromLdapInfo() error {
	return nil

}
