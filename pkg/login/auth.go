package login

import (
	"errors"
	"fmt"

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
	ErrForbiddenRedirectTo   = errors.New("Forbidden redirect_to cookie value")
)

var loginLogger = log.New("login")

func Init() {
	bus.AddHandler("auth", AuthenticateUser)
}

// AuthenticateUser authenticates the user via username & password
func AuthenticateUser(query *models.LoginUserQuery) error {
	if err := validateLoginAttempts(query.Username); err != nil {
		sendLoginLog(query.ReqContext, "", nil, err)
		return err
	}

	if err := validatePasswordSet(query.Password); err != nil {
		sendLoginLog(query.ReqContext, "", nil, err)
		return err
	}

	err := loginUsingGrafanaDB(query)
	if err == nil || (err != models.ErrUserNotFound && err != ErrInvalidCredentials && err != ErrUserDisabled) {
		sendLoginLog(query.ReqContext, "grafana", query.User, err)
		return err
	}

	ldapEnabled, ldapErr := loginUsingLDAP(query)
	if ldapEnabled {
		if ldapErr == nil || ldapErr != ldap.ErrInvalidCredentials {
			sendLoginLog(query.ReqContext, "ldap", query.User, ldapErr)
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

		sendLoginLog(query.ReqContext, "", nil, ErrInvalidCredentials)
		return ErrInvalidCredentials
	}

	if err == models.ErrUserNotFound {
		sendLoginLog(query.ReqContext, "", nil, models.ErrUserNotFound)
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

func sendLoginLog(ctx *models.ReqContext, name string, user *models.User, err error) {
	// Check to not send log if the function is called from the auth middleware
	if ctx == nil {
		return
	}

	action := "login"
	if name != "" {
		action = fmt.Sprintf("login-%s", name)
	}

	sendLoginLogCommand := models.SendLoginLogCommand{
		ReqContext: ctx,
		LogAction:  action,
		User:       user,
		Error:      err,
	}
	if err := bus.Dispatch(&sendLoginLogCommand); err != nil {
		if err != bus.ErrHandlerNotFound {
			loginLogger.Warn("Error while sending login log", "err", err)
		}
	}
}
