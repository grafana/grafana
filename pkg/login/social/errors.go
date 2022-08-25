package social

import "errors"

var (
	ErrIDTokenNotFound  = errors.New("id_token not found")
	ErrInvalidBasicRole = errors.New("user does not have a valid basic role")
	ErrEmailNotFound    = errors.New("error getting user info: no email found in access token")
)
