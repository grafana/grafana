package login

import "errors"

var (
	ErrEmailNotAllowed       = errors.New("Required email domain not fulfilled")
	ErrInvalidCredentials    = errors.New("Invalid Username or Password")
	ErrNoEmail               = errors.New("Login provider didn't return an email address")
	ErrProviderDeniedRequest = errors.New("Login provider denied login request")
	ErrSignUpNotAllowed      = errors.New("Signup is not allowed for this adapter")
	ErrTooManyLoginAttempts  = errors.New("Too many consecutive incorrect login attempts for user. Login for user temporarily blocked")
	ErrPasswordEmpty         = errors.New("No password provided")
	ErrUsersQuotaReached     = errors.New("Users quota reached")
	ErrGettingUserQuota      = errors.New("Error getting user quota")
)
