package login

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

type UserProtectionService interface {
	AllowUserMapping(user *user.User, authModule string) error
}

type Store interface {
	GetExternalUserInfoByLogin(ctx context.Context, query *GetExternalUserInfoByLoginQuery) error
	GetAuthInfo(ctx context.Context, query *GetAuthInfoQuery) error
	GetUserLabels(ctx context.Context, query GetUserLabelsQuery) (map[int64]string, error)
	SetAuthInfo(ctx context.Context, cmd *SetAuthInfoCommand) error
	UpdateAuthInfo(ctx context.Context, cmd *UpdateAuthInfoCommand) error
	UpdateAuthInfoDate(ctx context.Context, authInfo *UserAuth) error
	DeleteAuthInfo(ctx context.Context, cmd *DeleteAuthInfoCommand) error
	GetUserById(ctx context.Context, id int64) (*user.User, error)
	GetUserByLogin(ctx context.Context, login string) (*user.User, error)
	GetUserByEmail(ctx context.Context, email string) (*user.User, error)
	CollectLoginStats(ctx context.Context) (map[string]interface{}, error)
	RunMetricsCollection(ctx context.Context) error
	GetLoginStats(ctx context.Context) (LoginStats, error)
}
