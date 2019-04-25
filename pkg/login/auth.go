package login

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	LDAP "github.com/grafana/grafana/pkg/services/ldap"
)

var (
	ErrEmailNotAllowed       = errors.New("Required email domain not fulfilled")
	ErrNoLDAPServers         = errors.New("No LDAP servers are configured")
	ErrInvalidCredentials    = errors.New("Invalid Username or Password")
	ErrNoEmail               = errors.New("Login provider didn't return an email address")
	ErrProviderDeniedRequest = errors.New("Login provider denied login request")
	ErrSignUpNotAllowed      = errors.New("Signup is not allowed for this adapter")
	ErrTooManyLoginAttempts  = errors.New("Too many consecutive incorrect login attempts for user. Login for user temporarily blocked")
	ErrPasswordEmpty         = errors.New("No password provided")
	ErrUsersQuotaReached     = errors.New("Users quota reached")
	ErrGettingUserQuota      = errors.New("Error getting user quota")
)

func Init() {
	bus.AddHandler("auth", AuthenticateUser)
}

func AuthenticateUser(query *m.LoginUserQuery) error {
	if err := validateLoginAttempts(query.Username); err != nil {
		return err
	}

	if err := validatePasswordSet(query.Password); err != nil {
		return err
	}

	err := loginUsingGrafanaDB(query)
	if err == nil || (err != m.ErrUserNotFound && err != ErrInvalidCredentials) {
		return err
	}

	ldapEnabled, ldapErr := loginUsingLdap(query)
	if ldapEnabled {
		if ldapErr == nil || ldapErr != LDAP.ErrInvalidCredentials {
			return ldapErr
		}

		err = ldapErr
	}

	if err == ErrInvalidCredentials || err == LDAP.ErrInvalidCredentials {
		saveInvalidLoginAttempt(query)
	}

	if err == m.ErrUserNotFound {
		return ErrInvalidCredentials
	}

	return err
}
func validatePasswordSet(password string) error {
	if len(password) == 0 {
		return ErrPasswordEmpty
	}

	return nil
}
