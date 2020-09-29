package auth

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func (srv *UserAuthTokenService) Run(ctx context.Context) error {
	var err error
	ticker := time.NewTicker(time.Hour)
	maxInactiveLifetime := srv.Cfg.LoginMaxInactiveLifetime
	maxLifetime := srv.Cfg.LoginMaxLifetime

	err = srv.ServerLockService.LockAndExecute(ctx, "cleanup expired auth tokens", time.Hour*12, func() {
		if _, err := srv.deleteExpiredTokens(ctx, maxInactiveLifetime, maxLifetime); err != nil {
			srv.log.Error("An error occurred while deleting expired tokens", "err", err)
		}
	})
	if err != nil {
		srv.log.Error("failed to lock and execute cleanup of expired auth token", "error", err)
	}

	for {
		select {
		case <-ticker.C:
			err = srv.ServerLockService.LockAndExecute(ctx, "cleanup expired auth tokens", time.Hour*12, func() {
				if _, err := srv.deleteExpiredTokens(ctx, maxInactiveLifetime, maxLifetime); err != nil {
					srv.log.Error("An error occurred while deleting expired tokens", "err", err)
				}
			})
			if err != nil {
				srv.log.Error("failed to lock and execute cleanup of expired auth token", "error", err)
			}

		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (srv *UserAuthTokenService) deleteExpiredTokens(ctx context.Context, maxInactiveLifetime, maxLifetime time.Duration) (int64, error) {
	createdBefore := getTime().Add(-maxLifetime)
	rotatedBefore := getTime().Add(-maxInactiveLifetime)

	srv.log.Debug("starting cleanup of expired auth tokens", "createdBefore", createdBefore, "rotatedBefore", rotatedBefore)

	var affected int64
	err := srv.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		sql := `DELETE from user_auth_token WHERE created_at <= ? OR rotated_at <= ?`
		res, err := dbSession.Exec(sql, createdBefore.Unix(), rotatedBefore.Unix())
		if err != nil {
			return err
		}

		affected, err = res.RowsAffected()
		if err != nil {
			srv.log.Error("failed to cleanup expired auth tokens", "error", err)
			return nil
		}

		srv.log.Debug("cleanup of expired auth tokens done", "count", affected)

		return nil
	})

	return affected, err
}
