package models

import (
	"context"
	"errors"
	"net"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/user"
)

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

type TokenRevokedError struct {
	UserID                int64
	TokenID               int64
	MaxConcurrentSessions int64
}

func (e *TokenRevokedError) Error() string { return "user token revoked" }

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

type RevokeAuthTokenCmd struct {
	AuthTokenId int64 `json:"authTokenId"`
}

// UserTokenService are used for generating and validating user tokens
type UserTokenService interface {
	CreateToken(ctx context.Context, user *user.User, clientIP net.IP, userAgent string) (*UserToken, error)
	LookupToken(ctx context.Context, unhashedToken string) (*UserToken, error)
	TryRotateToken(ctx context.Context, token *UserToken, clientIP net.IP, userAgent string) (bool, error)
	RevokeToken(ctx context.Context, token *UserToken, soft bool) error
	RevokeAllUserTokens(ctx context.Context, userId int64) error
	GetUserToken(ctx context.Context, userId, userTokenId int64) (*UserToken, error)
	GetUserTokens(ctx context.Context, userId int64) ([]*UserToken, error)
	GetUserRevokedTokens(ctx context.Context, userId int64) ([]*UserToken, error)
}

type ActiveTokenService interface {
	ActiveTokenCount(ctx context.Context) (int64, error)
}

type UserTokenBackgroundService interface {
	registry.BackgroundService
}
