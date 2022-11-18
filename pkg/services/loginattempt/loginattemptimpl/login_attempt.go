package loginattemptimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	maxInvalidLoginAttempts int64 = 5
	loginAttemptsWindow           = time.Minute * 5
)

func ProvideService(db db.DB, cfg *setting.Cfg) loginattempt.Service {
	return &Service{
		&xormStore{db: db, now: time.Now},
		cfg,
	}
}

type Service struct {
	store store
	cfg   *setting.Cfg
}

func (s *Service) RecordAttempt(ctx context.Context, username, IPAddress string) error {
	if s.cfg.DisableBruteForceLoginProtection {
		return nil
	}

	return s.store.CreateLoginAttempt(ctx, &CreateLoginAttemptCommand{
		Username:  username,
		IpAddress: IPAddress,
	})
}

func (s *Service) ValidateAttempts(ctx context.Context, username string) (bool, error) {
	if s.cfg.DisableBruteForceLoginProtection {
		return true, nil
	}

	loginAttemptCountQuery := GetUserLoginAttemptCountQuery{
		Username: username,
		Since:    time.Now().Add(-loginAttemptsWindow),
	}

	if err := s.store.GetUserLoginAttemptCount(ctx, &loginAttemptCountQuery); err != nil {
		return false, err
	}

	if loginAttemptCountQuery.Result >= maxInvalidLoginAttempts {
		return false, nil
	}

	return true, nil
}

func (s *Service) DeleteOldLoginAttempts(ctx context.Context, cmd *loginattempt.DeleteOldLoginAttemptsCommand) error {
	err := s.store.DeleteOldLoginAttempts(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}
