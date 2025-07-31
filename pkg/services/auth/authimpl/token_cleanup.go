package authimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

func (s *UserAuthTokenService) Run(ctx context.Context) error {
	ticker := time.NewTicker(time.Hour)
	cfg := s.settingsProvider.Get()
	maxInactiveLifetime := cfg.LoginMaxInactiveLifetime
	maxLifetime := cfg.LoginMaxLifetime

	err := s.serverLockService.LockAndExecute(ctx, "cleanup expired auth tokens", time.Hour*12, func(context.Context) {
		if _, err := s.deleteExpiredTokens(ctx, maxInactiveLifetime, maxLifetime); err != nil {
			s.log.Error("An error occurred while deleting expired tokens", "err", err)
		}
		if err := s.deleteOrphanedExternalSessions(ctx); err != nil {
			s.log.Error("An error occurred while deleting orphaned external sessions", "err", err)
		}
	})
	if err != nil {
		s.log.Error("Failed to lock and execute cleanup of expired auth token", "error", err)
	}

	for {
		select {
		case <-ticker.C:
			err = s.serverLockService.LockAndExecute(ctx, "cleanup expired auth tokens", time.Hour*12, func(context.Context) {
				if _, err := s.deleteExpiredTokens(ctx, maxInactiveLifetime, maxLifetime); err != nil {
					s.log.Error("An error occurred while deleting expired tokens", "err", err)
				}
				if err := s.deleteOrphanedExternalSessions(ctx); err != nil {
					s.log.Error("An error occurred while deleting orphaned external sessions", "err", err)
				}
			})
			if err != nil {
				s.log.Error("Failed to lock and execute cleanup of expired auth token", "error", err)
			}

		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (s *UserAuthTokenService) deleteExpiredTokens(ctx context.Context, maxInactiveLifetime, maxLifetime time.Duration) (int64, error) {
	createdBefore := getTime().Add(-maxLifetime)
	rotatedBefore := getTime().Add(-maxInactiveLifetime)

	s.log.Debug("Starting cleanup of expired auth tokens", "createdBefore", createdBefore, "rotatedBefore", rotatedBefore)

	var affected int64
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		sql := `DELETE from user_auth_token WHERE created_at <= ? OR rotated_at <= ?`
		res, err := dbSession.Exec(sql, createdBefore.Unix(), rotatedBefore.Unix())
		if err != nil {
			return err
		}

		affected, err = res.RowsAffected()
		if err != nil {
			s.log.Error("Failed to cleanup expired auth tokens", "error", err)
			return nil
		}

		s.log.Debug("Cleanup of expired auth tokens done", "count", affected)

		return nil
	})

	return affected, err
}

func (s *UserAuthTokenService) deleteOrphanedExternalSessions(ctx context.Context) error {
	s.log.Debug("Starting cleanup of external sessions")

	var affected int64
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		sql := `DELETE FROM user_external_session WHERE NOT EXISTS (SELECT 1 FROM user_auth_token WHERE user_external_session.id = user_auth_token.external_session_id)`

		res, err := dbSession.Exec(sql)
		if err != nil {
			return err
		}

		affected, err = res.RowsAffected()
		if err != nil {
			s.log.Error("Failed to cleanup orphaned external sessions", "error", err)
			return nil
		}

		s.log.Debug("Cleanup of orphaned external sessions done", "count", affected)

		return nil
	})

	return err
}
