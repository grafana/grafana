package loginattemptimpl

import (
	"context"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/setting"
)

const loginAttemptsWindow = time.Minute * 5

func ProvideService(db db.DB, cfg *setting.Cfg, lock *serverlock.ServerLockService) *Service {
	return &Service{
		&xormStore{db: db, now: time.Now},
		cfg,
		lock,
		log.New("login_attempt"),
	}
}

type Service struct {
	store  store
	cfg    *setting.Cfg
	lock   *serverlock.ServerLockService
	logger log.Logger
}

func (s *Service) Run(ctx context.Context) error {
	// no need to run clean up job if it is disabled
	if s.cfg.DisableBruteForceLoginProtection {
		return nil
	}

	ticker := time.NewTicker(time.Minute * 10)
	for {
		select {
		case <-ticker.C:
			s.cleanup(ctx)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (s *Service) Add(ctx context.Context, username, IPAddress string) error {
	if s.cfg.DisableBruteForceLoginProtection {
		return nil
	}

	_, err := s.store.CreateLoginAttempt(ctx, CreateLoginAttemptCommand{
		Username:  strings.ToLower(username),
		IPAddress: IPAddress,
	})
	return err
}

func (s *Service) Reset(ctx context.Context, username string) error {
	return s.store.DeleteLoginAttempts(ctx, DeleteLoginAttemptsCommand{strings.ToLower(username)})
}

func (s *Service) Validate(ctx context.Context, username string) (bool, error) {
	if s.cfg.DisableBruteForceLoginProtection {
		return true, nil
	}

	loginAttemptCountQuery := GetUserLoginAttemptCountQuery{
		Username: strings.ToLower(username),
		Since:    time.Now().Add(-loginAttemptsWindow),
	}

	count, err := s.store.GetUserLoginAttemptCount(ctx, loginAttemptCountQuery)
	if err != nil {
		return false, err
	}

	if count >= s.cfg.BruteForceLoginProtectionMaxAttempts {
		return false, nil
	}

	return true, nil
}

func (s *Service) ValidateIPAddress(ctx context.Context, IPAddress string) (bool, error) {
	if s.cfg.DisableIPAddressLoginProtection {
		return true, nil
	}

	loginAttemptCountQuery := GetIPLoginAttemptCountQuery{
		IPAddress: IPAddress,
		Since:     time.Now().Add(-loginAttemptsWindow),
	}

	count, err := s.store.GetIPLoginAttemptCount(ctx, loginAttemptCountQuery)
	if err != nil {
		return false, err
	}

	if count >= s.cfg.BruteForceLoginProtectionMaxAttempts {
		return false, nil
	}

	return true, nil
}

func (s *Service) cleanup(ctx context.Context) {
	err := s.lock.LockAndExecute(ctx, "delete old login attempts", time.Minute*10, func(context.Context) {
		cmd := DeleteOldLoginAttemptsCommand{
			OlderThan: time.Now().Add(time.Minute * -10),
		}
		if deletedLogs, err := s.store.DeleteOldLoginAttempts(ctx, cmd); err != nil {
			s.logger.Error("Problem deleting expired login attempts", "error", err.Error())
		} else {
			s.logger.Debug("Deleted expired login attempts", "rows affected", deletedLogs)
		}
	})
	if err != nil {
		s.logger.Error("Failed to lock and execute cleanup of old login attempts", "error", err)
	}
}
