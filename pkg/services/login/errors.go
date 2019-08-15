package login

import "errors"

var (
	ErrInvalidCredentials = errors.New("Invalid Username or Password")
	ErrUsersQuotaReached  = errors.New("Users quota reached")
	ErrGettingUserQuota   = errors.New("Error getting user quota")
)
