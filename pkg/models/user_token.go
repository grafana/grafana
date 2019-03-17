package models

import (
	"errors"
)

// Typed errors
var (
	ErrUserTokenNotFound = errors.New("user token not found")
)

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
	UnhashedToken string
}

type RevokeAuthTokenCmd struct {
	AuthTokenId int64 `json:"authTokenId"`
}

// UserTokenService are used for generating and validating user tokens
type UserTokenService interface {
	CreateToken(userId int64, clientIP, userAgent string) (*UserToken, error)
	LookupToken(unhashedToken string) (*UserToken, error)
	TryRotateToken(token *UserToken, clientIP, userAgent string) (bool, error)
	RevokeToken(token *UserToken) error
	RevokeAllUserTokens(userId int64) error
	ActiveTokenCount() (int64, error)
	GetUserToken(userId, userTokenId int64) (*UserToken, error)
	GetUserTokens(userId int64) ([]*UserToken, error)
}
