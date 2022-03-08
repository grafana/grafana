package login

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type UserProtectionService interface {
	AllowUserMapping(user *models.User, authModule string) error
}

type Store interface {
	GetExternalUserInfoByLogin(ctx context.Context, query *models.GetExternalUserInfoByLoginQuery) error
	GetAuthInfo(ctx context.Context, query *models.GetAuthInfoQuery) error
	SetAuthInfo(ctx context.Context, cmd *models.SetAuthInfoCommand) error
	UpdateAuthInfo(ctx context.Context, cmd *models.UpdateAuthInfoCommand) error
	DeleteAuthInfo(ctx context.Context, cmd *models.DeleteAuthInfoCommand) error
	GetUserById(id int64) (bool, *models.User, error)
	GetUser(user *models.User) (bool, error)
}
