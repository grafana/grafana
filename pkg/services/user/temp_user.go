package user

import (
	"context"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"time"
)

const (
	userInviteLifetime = 7 * 24 * time.Hour
	executionInterval  = 24 * time.Hour
)

type TempUserService struct {
	SQLStore          *sqlstore.SqlStore            `inject:""`
	ServerLockService *serverlock.ServerLockService `inject:""`
	Cfg               *setting.Cfg                  `inject:""`
	log               log.Logger
}

func init() {
	registry.RegisterService(&TempUserService{})
}

func (s *TempUserService) Init() error {
	s.log = log.New("user")
	return nil
}

func (srv *TempUserService) Run(ctx context.Context) error {
	ticker := time.NewTicker(executionInterval)

	srv.cleanupUserInvites(ctx)

	for {
		select {
		case <-ticker.C:
			srv.cleanupUserInvites(ctx)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (srv *TempUserService) cleanupUserInvites(ctx context.Context) {
	err := srv.ServerLockService.LockAndExecute(ctx, "cleanup expired user invites", executionInterval, func() {
		if _, err := srv.deleteExpiredUserInvites(ctx, userInviteLifetime); err != nil {
			srv.log.Error("An error occurred while deleting expired tokens", "err", err)
		}
	})
	if err != nil {
		srv.log.Error("failed to lock and execute cleanup of expired user invite", "error", err)
	}
}

func (srv *TempUserService) deleteExpiredUserInvites(ctx context.Context, lifetime time.Duration) (int64, error) {
	sql := `DELETE from temp_user WHERE created_at <= ?`
	createdBefore := time.Now().Add(-lifetime)

	srv.log.Debug("starting cleanup of expired user invites", "createdBefore", createdBefore)

	var affected int64
	err := srv.SQLStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		res, err := dbSession.Exec(sql, createdBefore.Unix())
		if err != nil {
			return err
		}

		affected, err = res.RowsAffected()
		if err != nil {
			srv.log.Error("failed to cleanup expired user invites", "error", err)
			return nil
		}

		srv.log.Debug("cleanup of expired user invites done", "count", affected)

		return nil
	})

	return affected, err
}
