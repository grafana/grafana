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

	log.Info("Host: %v", url.Host)
	conn, err := ldap.Dial("tcp", url.Host)
	if err != nil {
		return err
	}

	defer conn.Close()

	bindFormat := "cn=%s,dc=grafana,dc=org"

	nx := fmt.Sprintf(bindFormat, query.Username)
	err = conn.Bind(nx, query.Password)

	if err != nil {
		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: "admin"}
	err = bus.Dispatch(&userQuery)

	if err != nil {
		if err == m.ErrUserNotFound {
			return ErrInvalidCredentials
		}
		return err
	}

	query.User = userQuery.Result

	return nil
}
