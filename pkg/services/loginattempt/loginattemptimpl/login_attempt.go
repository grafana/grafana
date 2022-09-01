package loginattemptimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type Service struct {
	store store
}

func ProvideService(db db.DB) loginattempt.Service {
	return &Service{
		store: &xormStore{db: db, now: time.Now},
	}
}

func (s *Service) CreateLoginAttempt(ctx context.Context, cmd *models.CreateLoginAttemptCommand) error {
	err := s.store.CreateLoginAttempt(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) DeleteOldLoginAttempts(ctx context.Context, cmd *models.DeleteOldLoginAttemptsCommand) error {
	err := s.store.DeleteOldLoginAttempts(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) GetUserLoginAttemptCount(ctx context.Context, cmd *models.GetUserLoginAttemptCountQuery) error {
	err := s.store.GetUserLoginAttemptCount(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}
