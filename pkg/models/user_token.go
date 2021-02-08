package models

import (
	"context"
	"errors"
	"net"
)

// Typed errors
var (
	ErrUserTokenNotFound = errors.New("user token not found")
)

type TokenExpiredError struct {
	UserID  int64
	TokenID int64
}

func (e *TokenExpiredError) Error() string { return "user token expired" }

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
	CreateToken(ctx context.Context, user *User, clientIP net.IP, userAgent string) (*UserToken, error)
	LookupToken(ctx context.Context, unhashedToken string) (*UserToken, error)
	TryRotateToken(ctx context.Context, token *UserToken, clientIP net.IP, userAgent string) (bool, error)
	RevokeToken(ctx context.Context, token *UserToken) error
	RevokeAllUserTokens(ctx context.Context, userId int64) error
	ActiveTokenCount(ctx context.Context) (int64, error)
	GetUserToken(ctx context.Context, userId, userTokenId int64) (*UserToken, error)
	GetUserTokens(ctx context.Context, userId int64) ([]*UserToken, error)
}
