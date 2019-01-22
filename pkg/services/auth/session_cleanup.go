package auth

import (
	"context"
	"time"
)

func (srv *UserAuthTokenServiceImpl) Run(ctx context.Context) error {
	ticker := time.NewTicker(time.Hour * 12)
	deleteSessionAfter := time.Hour * 24 * time.Duration(srv.Cfg.LoginDeleteExpiredTokensAfterDays)

	for {
		select {
		case <-ticker.C:
			srv.ServerLockService.LockAndExecute(ctx, "delete old sessions", time.Hour*12, func() {
				srv.deleteOldSession(deleteSessionAfter)
			})

		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (srv *UserAuthTokenServiceImpl) deleteOldSession(deleteSessionAfter time.Duration) (int64, error) {
	sql := `DELETE from user_auth_token WHERE rotated_at < ?`

	deleteBefore := getTime().Add(-deleteSessionAfter)
	res, err := srv.SQLStore.NewSession().Exec(sql, deleteBefore.Unix())
	if err != nil {
		return 0, err
	}

	affected, err := res.RowsAffected()
	srv.log.Info("deleted old sessions", "count", affected)

	return affected, err
}
