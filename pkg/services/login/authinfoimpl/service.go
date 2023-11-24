package authinfoimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/login"
)

type Service struct {
	authInfoStore login.Store
	logger        log.Logger
}

func ProvideService(authInfoStore login.Store) *Service {
	s := &Service{
		authInfoStore: authInfoStore,
		logger:        log.New("login.authinfo"),
	}

	return s
}

func (s *Service) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	return s.authInfoStore.GetAuthInfo(ctx, query)
}

func (s *Service) GetUserLabels(ctx context.Context, query login.GetUserLabelsQuery) (map[int64]string, error) {
	if len(query.UserIDs) == 0 {
		return map[int64]string{}, nil
	}
	return s.authInfoStore.GetUserLabels(ctx, query)
}

func (s *Service) UpdateAuthInfo(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
	return s.authInfoStore.UpdateAuthInfo(ctx, cmd)
}

func (s *Service) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	return s.authInfoStore.SetAuthInfo(ctx, cmd)
}

func (s *Service) DeleteUserAuthInfo(ctx context.Context, userID int64) error {
	return s.authInfoStore.DeleteUserAuthInfo(ctx, userID)
}
