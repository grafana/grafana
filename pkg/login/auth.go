package login

import (
	"errors"
	"time"

	"crypto/subtle"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	ErrInvalidCredentials   = errors.New("Invalid Username or Password")
	ErrTooManyLoginAttempts = errors.New("Too many consecutive incorrect login attempts for user. Login for user temporarily blocked.")
)

type LoginUserQuery struct {
	Username  string
	Password  string
	User      *m.User
	IpAddress string
}

func Init() {
	bus.AddHandler("auth", AuthenticateUser)
	loadLdapConfig()
}

func AuthenticateUser(query *LoginUserQuery) error {
	err := loginUsingGrafanaDB(query)
	if err == nil || (err != m.ErrUserNotFound && err != ErrInvalidCredentials) {
		return err
	}

	if setting.LdapEnabled {
		for _, server := range LdapCfg.Servers {
			author := NewLdapAuthenticator(server)
			err = author.Login(query)
			if err == nil || err != ErrInvalidCredentials {
				return err
			}
		}
	} else if err == ErrInvalidCredentials {
		loginAttemptCommand := m.CreateLoginAttemptCommand{
			Username:  query.Username,
			IpAddress: query.IpAddress,
		}

		bus.Dispatch(&loginAttemptCommand)
	}

	if err == m.ErrUserNotFound {
		return ErrInvalidCredentials
	}

	return err
}

func loginUsingGrafanaDB(query *LoginUserQuery) error {
	userQuery := m.GetUserByLoginQuery{LoginOrEmail: query.Username}

	if err := bus.Dispatch(&userQuery); err != nil {
		return err
	}

	if err := validateLoginAttemptCount(query.Username); err != nil {
		return err
	}

	user := userQuery.Result

	passwordHashed := util.EncodePassword(query.Password, user.Salt)
	if subtle.ConstantTimeCompare([]byte(passwordHashed), []byte(user.Password)) != 1 {
		return ErrInvalidCredentials
	}

	query.User = user
	return nil
}

func validateLoginAttemptCount(username string) error {
	loginAttemptCountQuery := m.GetUserLoginAttemptCountQuery{
		Username: username,
		Since:    time.Now().Add(time.Minute * -5),
	}

	if err := bus.Dispatch(&loginAttemptCountQuery); err != nil {
		return err
	}

	if loginAttemptCountQuery.Result >= 5 {
		return ErrTooManyLoginAttempts
	}

	return nil
}
