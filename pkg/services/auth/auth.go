package auth

import (
	"context"
	"errors"
	"fmt"
	"net"
	"time"

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

type ExternalSession struct {
	ID            int64     `xorm:"pk autoincr 'id'"`
	UserID        int64     `xorm:"user_id"`
	UserAuthID    int64     `xorm:"user_auth_id"`
	AccessToken   string    `xorm:"access_token"`
	IDToken       string    `xorm:"id_token"`
	RefreshToken  string    `xorm:"refresh_token"`
	SessionID     string    `xorm:"session_id"`
	SessionIDHash string    `xorm:"session_id_hash"`
	NameID        string    `xorm:"name_id"`
	NameIDHash    string    `xorm:"name_id_hash"`
	ExpiresAt     time.Time `xorm:"expires_at"`
	CreatedAt     time.Time `xorm:"created 'created_at'"`
}

func (e *ExternalSession) Clone() *ExternalSession {
	return &ExternalSession{
		ID:            e.ID,
		UserID:        e.UserID,
		UserAuthID:    e.UserAuthID,
		AccessToken:   e.AccessToken,
		IDToken:       e.IDToken,
		RefreshToken:  e.RefreshToken,
		SessionID:     e.SessionID,
		SessionIDHash: e.SessionIDHash,
		NameID:        e.NameID,
		NameIDHash:    e.NameIDHash,
		ExpiresAt:     e.ExpiresAt,
		CreatedAt:     e.CreatedAt,
	}
}

type GetExternalSessionQuery struct {
	ID           int64
	NameID       string
	SessionIndex string
}

type ExternalSessionStore interface {
	// GetExternalSession returns the external session
	GetExternalSession(ctx context.Context, ID int64) (*ExternalSession, error)
	// FindExternalSessions returns all external sessions fπor the given query
	FindExternalSessions(ctx context.Context, query *GetExternalSessionQuery) ([]*ExternalSession, error)
	// CreateExternalSession creates a new external session for a user
	CreateExternalSession(ctx context.Context, extSesion *ExternalSession) error
	// DeleteExternalSession deletes an external session
	DeleteExternalSession(ctx context.Context, ID int64) error
	// DeleteExternalSessionBySessionID deletes an external session
	DeleteExternalSessionsByUserID(ctx context.Context, userID int64) error
}

//go:generate mockery --name ExternalSessionService --structname MockService --outpkg externalsessiontest --filename service_mock.go --output ./externalsessiontest/
type ExternalSessionService interface {
	// GetExternalSession returns the external session for a user
	GetExternalSession(ctx context.Context, ID int64) (*ExternalSession, error)
	// FindExternalSessions returns all external sessions for the given query
	FindExternalSessions(ctx context.Context, query *GetExternalSessionQuery) ([]*ExternalSession, error)
}

// UserTokenService are used for generating and validating user tokens
type UserTokenService interface {
	CreateToken(ctx context.Context, user *user.User, clientIP net.IP, userAgent string, extSession *ExternalSession) (*UserToken, error)
	LookupToken(ctx context.Context, unhashedToken string) (*UserToken, error)
	GetTokenByExternalSessionID(ctx context.Context, externalSessionID int64) (*UserToken, error)
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
