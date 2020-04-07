package login

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
)

var (
	ErrEmailNotAllowed       = errors.New("Required email domain not fulfilled")
	ErrInvalidCredentials    = errors.New("Invalid Username or Password")
	ErrNoEmail               = errors.New("Login provider didn't return an email address")
	ErrProviderDeniedRequest = errors.New("Login provider denied login request")
	ErrSignUpNotAllowed      = errors.New("Signup is not allowed for this adapter")
	ErrTooManyLoginAttempts  = errors.New("Too many consecutive incorrect login attempts for user. Login for user temporarily blocked")
	ErrPasswordEmpty         = errors.New("No password provided")
	ErrUserDisabled          = errors.New("User is disabled")
	ErrAbsoluteRedirectTo    = errors.New("Absolute urls are not allowed for redirect_to cookie value")
	ErrInvalidRedirectTo     = errors.New("Invalid redirect_to cookie value")
)

var loginLogger = log.New("login")

func Init() {
	bus.AddHandler("auth", AuthenticateUser)
}

// AuthenticateUser authenticates the user via username & password
func AuthenticateUser(query *models.LoginUserQuery) error {
	if err := validateLoginAttempts(query.Username); err != nil {
		return err
	}

	if err := validatePasswordSet(query.Password); err != nil {
		return err
	}

	err := loginUsingGrafanaDB(query)
	if err == nil || (err != models.ErrUserNotFound && err != ErrInvalidCredentials && err != ErrUserDisabled) {
		return err
	}

	ldapEnabled, ldapErr := loginUsingLDAP(query)
	if ldapEnabled {
		if ldapErr == nil || ldapErr != ldap.ErrInvalidCredentials {
			return ldapErr
		}

		if err != ErrUserDisabled || ldapErr != ldap.ErrInvalidCredentials {
			err = ldapErr
		}
	}

	if err == ErrInvalidCredentials || err == ldap.ErrInvalidCredentials {
		if err := saveInvalidLoginAttempt(query); err != nil {
			loginLogger.Error("Failed to save invalid login attempt", "err", err)
		}

		return ErrInvalidCredentials
	}

	if err == models.ErrUserNotFound {
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
