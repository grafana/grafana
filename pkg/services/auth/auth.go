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
	ErrUserTokenNotFound       = errors.New("user token not found")
	ErrInvalidSessionToken     = usertoken.ErrInvalidSessionToken
	ErrExternalSessionNotFound = errors.New("external session not found")
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

type CreateTokenCommand struct {
	User            *user.User
	ClientIP        net.IP
	UserAgent       string
	ExternalSession *ExternalSession
}

// UserTokenService are used for generating and validating user tokens
//
//go:generate mockery --name UserTokenService --structname MockUserAuthTokenService --outpkg authtest --filename auth_token_service_mock.go --output ./authtest/
type UserTokenService interface {
	CreateToken(ctx context.Context, cmd *CreateTokenCommand) (*UserToken, error)
	LookupToken(ctx context.Context, unhashedToken string) (*UserToken, error)
	GetTokenByExternalSessionID(ctx context.Context, externalSessionID int64) (*UserToken, error)
	GetExternalSession(ctx context.Context, externalSessionID int64) (*ExternalSession, error)
	FindExternalSessions(ctx context.Context, query *ListExternalSessionQuery) ([]*ExternalSession, error)
	UpdateExternalSession(ctx context.Context, externalSessionID int64, cmd *UpdateExternalSessionCommand) error

	// RotateToken will always rotate a valid token
	RotateToken(ctx context.Context, cmd RotateCommand) (*UserToken, error)
	RevokeToken(ctx context.Context, token *UserToken, soft bool) error
	RevokeAllUserTokens(ctx context.Context, userID int64) error
	GetUserToken(ctx context.Context, userID, userTokenID int64) (*UserToken, error)
	GetUserTokens(ctx context.Context, userID int64) ([]*UserToken, error)
	ActiveTokenCount(ctx context.Context, userID *int64) (int64, error)
	GetUserRevokedTokens(ctx context.Context, userID int64) ([]*UserToken, error)
}

type UserTokenBackgroundService interface {
	registry.BackgroundService
}

type JWTVerifierService = jwt.JWTService
