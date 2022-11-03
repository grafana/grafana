package auth

import "errors"

// Typed errors
var (
	ErrUserTokenNotFound = errors.New("user token not found")
)

// CreateTokenErr represents a token creation error; used in Enterprise
type CreateTokenErr struct {
	StatusCode  int
	InternalErr error
	ExternalErr string
}

func (e *CreateTokenErr) Error() string {
	if e.InternalErr != nil {
		return e.InternalErr.Error()
	}
	return "failed to create token"
}

type TokenExpiredError struct {
	UserID  int64
	TokenID int64
}

func (e *TokenExpiredError) Error() string { return "user token expired" }

type RevokeAuthTokenCmd struct {
	AuthTokenId int64 `json:"authTokenId"`
}
