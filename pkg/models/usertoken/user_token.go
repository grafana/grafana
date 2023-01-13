package usertoken

import (
	"errors"
	"fmt"
)

var ErrInvalidSessionToken = errors.New("invalid session token")

type TokenRevokedError struct {
	UserID                int64
	TokenID               int64
	MaxConcurrentSessions int64
}

func (e *TokenRevokedError) Error() string {
	return fmt.Sprintf("%s: user token revoked", ErrInvalidSessionToken)
}

func (e *TokenRevokedError) Unwrap() error { return ErrInvalidSessionToken }

// UserToken represents a user token
type UserToken struct {
	Id            int64
	UserId        int64
	AuthToken     string
	PrevAuthToken string
	UserAgent     string
	ClientIp      string
	AuthTokenSeen bool
	SeenAt        int64
	RotatedAt     int64
	CreatedAt     int64
	UpdatedAt     int64
	RevokedAt     int64
	UnhashedToken string
}
