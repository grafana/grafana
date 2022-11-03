package auth

import (
	"context"
	"net"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/user"
)

// UserTokenService are used for generating and validating user tokens
type UserTokenService interface {
	CreateToken(ctx context.Context, user *user.User, clientIP net.IP, userAgent string) (*models.UserToken, error)
	LookupToken(ctx context.Context, unhashedToken string) (*models.UserToken, error)
	TryRotateToken(ctx context.Context, token *models.UserToken, clientIP net.IP, userAgent string) (bool, error)
	RevokeToken(ctx context.Context, token *models.UserToken, soft bool) error
	RevokeAllUserTokens(ctx context.Context, userId int64) error
	GetUserToken(ctx context.Context, userId, userTokenId int64) (*models.UserToken, error)
	GetUserTokens(ctx context.Context, userId int64) ([]*models.UserToken, error)
	GetUserRevokedTokens(ctx context.Context, userId int64) ([]*models.UserToken, error)
}

type ActiveTokenService interface {
	ActiveTokenCount(ctx context.Context) (int64, error)
}

type UserTokenBackgroundService interface {
	registry.BackgroundService
}
