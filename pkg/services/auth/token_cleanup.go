package auth

import (
	"context"
	"time"
)

func (srv *UserAuthTokenService) Run(ctx context.Context) error {
	ticker := time.NewTicker(time.Hour)
	maxInactiveLifetime := time.Duration(srv.Cfg.LoginMaxInactiveLifetimeDays) * 24 * time.Hour
	maxLifetime := time.Duration(srv.Cfg.LoginMaxLifetimeDays) * 24 * time.Hour

	err := srv.ServerLockService.LockAndExecute(ctx, "cleanup expired auth tokens", time.Hour*12, func() {
		srv.deleteExpiredTokens(maxInactiveLifetime, maxLifetime)
	})
	if err != nil {
		srv.log.Error("failed to lock and execite cleanup of expired auth token", "erro", err)
	}

	for {
		select {
		case <-ticker.C:
			err := srv.ServerLockService.LockAndExecute(ctx, "cleanup expired auth tokens", time.Hour*12, func() {
				srv.deleteExpiredTokens(maxInactiveLifetime, maxLifetime)
			})

			if err != nil {
				srv.log.Error("failed to lock and execite cleanup of expired auth token", "erro", err)
			}

		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (srv *UserAuthTokenService) deleteExpiredTokens(maxInactiveLifetime, maxLifetime time.Duration) (int64, error) {
	createdBefore := getTime().Add(-maxLifetime)
	rotatedBefore := getTime().Add(-maxInactiveLifetime)

	srv.log.Debug("starting cleanup of expired auth tokens", "createdBefore", createdBefore, "rotatedBefore", rotatedBefore)

	sql := `DELETE from user_auth_token WHERE created_at <= ? OR rotated_at <= ?`
	res, err := srv.SQLStore.NewSession().Exec(sql, createdBefore.Unix(), rotatedBefore.Unix())
	if err != nil {
		return 0, err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		srv.log.Error("failed to cleanup expired auth tokens", "error", err)
		return 0, nil
	}

	srv.log.Debug("cleanup of expired auth tokens done", "count", affected)
	return affected, err
}
