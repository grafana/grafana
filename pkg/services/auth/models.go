package auth

import "errors"

// Typed errors
var (
	ErrUserTokenNotFound = errors.New("user token not found")
)

type RevokeAuthTokenCmd struct {
	AuthTokenId int64 `json:"authTokenId"`
}
