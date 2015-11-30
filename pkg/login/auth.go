package login

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	ErrInvalidCredentials = errors.New("Invalid Username or Password")
)

type LoginUserQuery struct {
	Username string
	Password string
	User     *m.User
}

func Init() {
	bus.AddHandler("auth", AuthenticateUser)
	loadLdapConfig()
}

func AuthenticateUser(query *LoginUserQuery) error {
	err := loginUsingGrafanaDB(query)
	if err == nil || err != ErrInvalidCredentials {
		return err
	}

	if setting.LdapEnabled {
		for _, server := range ldapCfg.Servers {
			auther := NewLdapAuthenticator(server)
			err = auther.login(query)
			if err == nil || err != ErrInvalidCredentials {
				return err
			}
		}
	}

	return err
}

func loginUsingGrafanaDB(query *LoginUserQuery) error {
	userQuery := m.GetUserByLoginQuery{LoginOrEmail: query.Username}

	if err := bus.Dispatch(&userQuery); err != nil {
		if err == m.ErrUserNotFound {
			return ErrInvalidCredentials
		}
		return err
	}

	user := userQuery.Result

	passwordHashed := util.EncodePassword(query.Password, user.Salt)
	if passwordHashed != user.Password {
		return ErrInvalidCredentials
	}

	query.User = user
	return nil
}
