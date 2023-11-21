package authinfoservice

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/login"
)

type Implementation struct {
	authInfoStore login.Store
	logger        log.Logger
}

func ProvideAuthInfoService(authInfoStore login.Store) *Implementation {
	s := &Implementation{
		authInfoStore: authInfoStore,
		logger:        log.New("login.authinfo"),
	}

	return s
}

func (s *Implementation) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	return s.authInfoStore.GetAuthInfo(ctx, query)
}

func (s *Implementation) GetUserLabels(ctx context.Context, query login.GetUserLabelsQuery) (map[int64]string, error) {
	if len(query.UserIDs) == 0 {
		return map[int64]string{}, nil
	}
	return s.authInfoStore.GetUserLabels(ctx, query)
}

func (s *Implementation) UpdateAuthInfo(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
	return s.authInfoStore.UpdateAuthInfo(ctx, cmd)
}

func (s *Implementation) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	return s.authInfoStore.SetAuthInfo(ctx, cmd)
}

func (s *Implementation) DeleteUserAuthInfo(ctx context.Context, userID int64) error {
	return s.authInfoStore.DeleteUserAuthInfo(ctx, userID)
}
