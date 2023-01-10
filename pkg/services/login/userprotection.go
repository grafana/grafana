package login

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
)

type UserProtectionService interface {
	AllowUserMapping(user *user.User, authModule string) error
}

type Store interface {
	GetExternalUserInfoByLogin(ctx context.Context, query *models.GetExternalUserInfoByLoginQuery) error
	GetAuthInfo(ctx context.Context, query *models.GetAuthInfoQuery) error
	GetUserLabels(ctx context.Context, query models.GetUserLabelsQuery) (map[int64]string, error)
	SetAuthInfo(ctx context.Context, cmd *models.SetAuthInfoCommand) error
	UpdateAuthInfo(ctx context.Context, cmd *models.UpdateAuthInfoCommand) error
	UpdateAuthInfoDate(ctx context.Context, authInfo *models.UserAuth) error
	DeleteAuthInfo(ctx context.Context, cmd *models.DeleteAuthInfoCommand) error
	GetUserById(ctx context.Context, id int64) (*user.User, error)
	GetUserByLogin(ctx context.Context, login string) (*user.User, error)
	GetUserByEmail(ctx context.Context, email string) (*user.User, error)
	CollectLoginStats(ctx context.Context) (map[string]interface{}, error)
	RunMetricsCollection(ctx context.Context) error
	GetLoginStats(ctx context.Context) (LoginStats, error)
}
