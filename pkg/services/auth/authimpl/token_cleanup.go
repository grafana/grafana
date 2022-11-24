package authimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

func (s *UserAuthTokenService) Run(ctx context.Context) error {
	ticker := time.NewTicker(time.Hour)
	maxInactiveLifetime := s.cfg.LoginMaxInactiveLifetime
	maxLifetime := s.cfg.LoginMaxLifetime

	err := s.serverLockService.LockAndExecute(ctx, "cleanup expired auth tokens", time.Hour*12, func(context.Context) {
		if _, err := s.deleteExpiredTokens(ctx, maxInactiveLifetime, maxLifetime); err != nil {
			s.log.Error("An error occurred while deleting expired tokens", "err", err)
		}
	})
	if err != nil {
		s.log.Error("failed to lock and execute cleanup of expired auth token", "error", err)
	}

	for {
		select {
		case <-ticker.C:
			err = s.serverLockService.LockAndExecute(ctx, "cleanup expired auth tokens", time.Hour*12, func(context.Context) {
				if _, err := s.deleteExpiredTokens(ctx, maxInactiveLifetime, maxLifetime); err != nil {
					s.log.Error("An error occurred while deleting expired tokens", "err", err)
				}
			})
			if err != nil {
				s.log.Error("failed to lock and execute cleanup of expired auth token", "error", err)
			}

		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (s *UserAuthTokenService) deleteExpiredTokens(ctx context.Context, maxInactiveLifetime, maxLifetime time.Duration) (int64, error) {
	createdBefore := getTime().Add(-maxLifetime)
	rotatedBefore := getTime().Add(-maxInactiveLifetime)

	s.log.Debug("starting cleanup of expired auth tokens", "createdBefore", createdBefore, "rotatedBefore", rotatedBefore)

	var affected int64
	err := s.sqlStore.WithDbSession(ctx, func(dbSession *db.Session) error {
		sql := `DELETE from user_auth_token WHERE created_at <= ? OR rotated_at <= ?`
		res, err := dbSession.Exec(sql, createdBefore.Unix(), rotatedBefore.Unix())
		if err != nil {
			return err
		}

		affected, err = res.RowsAffected()
		if err != nil {
			s.log.Error("failed to cleanup expired auth tokens", "error", err)
			return nil
		}

		s.log.Debug("cleanup of expired auth tokens done", "count", affected)

		return nil
	})

	return affected, err
}
