package loginattemptimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	loginattempt "github.com/grafana/grafana/pkg/services/login_attempt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type Service struct {
	// TODO remove sqlstore
	sqlStore *sqlstore.SQLStore
}

func ProvideService(
	ss *sqlstore.SQLStore,
) loginattempt.Service {
	return &Service{
		sqlStore: ss,
	}
}

func (s *Service) CreateLoginAttempt(ctx context.Context, cmd *models.CreateLoginAttemptCommand) error {
	err := s.sqlStore.CreateLoginAttempt(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) DeleteOldLoginAttempts(ctx context.Context, cmd *models.DeleteOldLoginAttemptsCommand) error {
	err := s.sqlStore.DeleteOldLoginAttempts(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) GetUserLoginAttemptCount(ctx context.Context, cmd *models.GetUserLoginAttemptCountQuery) error {
	err := s.sqlStore.GetUserLoginAttemptCount(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}
