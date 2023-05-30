package auth

import (
	"context"
	"errors"
	"fmt"
	"net"

	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/user"
)

const (
	QuotaTargetSrv quota.TargetSrv = "auth"
	QuotaTarget    quota.Target    = "session"
)

// Typed errors
var (
	ErrUserTokenNotFound   = errors.New("user token not found")
	ErrInvalidSessionToken = usertoken.ErrInvalidSessionToken
)

type (
	TokenRevokedError = usertoken.TokenRevokedError
	UserToken         = usertoken.UserToken
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

func (e *TokenExpiredError) Unwrap() error { return ErrInvalidSessionToken }

func (e *TokenExpiredError) Error() string {
	return fmt.Sprintf("%s: user token expired", ErrInvalidSessionToken)
}

type RevokeAuthTokenCmd struct {
	AuthTokenId int64 `json:"authTokenId"`
}

type RotateCommand struct {
	// token is the un-hashed token
	UnHashedToken string
	IP            net.IP
	UserAgent     string
}

// UserTokenService are used for generating and validating user tokens
type UserTokenService interface {
	CreateToken(ctx context.Context, user *user.User, clientIP net.IP, userAgent string) (*UserToken, error)
	LookupToken(ctx context.Context, unhashedToken string) (*UserToken, error)
	// RotateToken will always rotate a valid token
	RotateToken(ctx context.Context, cmd RotateCommand) (*UserToken, error)
	TryRotateToken(ctx context.Context, token *UserToken, clientIP net.IP, userAgent string) (bool, *UserToken, error)
	RevokeToken(ctx context.Context, token *UserToken, soft bool) error
	RevokeAllUserTokens(ctx context.Context, userId int64) error
	GetUserToken(ctx context.Context, userId, userTokenId int64) (*UserToken, error)
	GetUserTokens(ctx context.Context, userId int64) ([]*UserToken, error)
	GetUserRevokedTokens(ctx context.Context, userId int64) ([]*UserToken, error)
}

type UserTokenBackgroundService interface {
	registry.BackgroundService
}

type JWTVerifierService = jwt.JWTService
