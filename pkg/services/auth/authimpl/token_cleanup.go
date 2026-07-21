package authimpl

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

func (s *UserAuthTokenService) Run(ctx context.Context) error {
	ticker := time.NewTicker(time.Hour)
	cfg, err := s.cfgProvider.Get(ctx)
	if err != nil {
		return err
	}
	maxInactiveLifetime := cfg.LoginMaxInactiveLifetime
	maxLifetime := cfg.LoginMaxLifetime

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
	dbHelper, err := s.sql(ctx)
	if err != nil {
		return 0, fmt.Errorf("get legacy DB: %w", err)
	}
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		query := tokenQuery{SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()), TokenTable: dbHelper.Table("user_auth_token"), CreatedBefore: createdBefore.Unix(), RotatedBefore: rotatedBefore.Unix()}
		querySQL, err := sqltemplate.Execute(deleteExpiredTokensTemplate, query)
		if err != nil {
			return err
		}
		res, err := dbSession.Exec(append([]any{querySQL}, query.GetArgs()...)...)
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
	dbHelper, err := s.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		query := orphanedExternalSessionsQuery{
			SQLTemplate:                  sqltemplate.New(dbHelper.DialectForDriver()),
			ExternalSessionTable:         dbHelper.Table("user_external_session"),
			TokenTable:                   dbHelper.Table("user_auth_token"),
			ExternalSessionIDColumn:      "user_external_session.id",
			TokenExternalSessionIDColumn: "token.external_session_id",
		}
		querySQL, err := sqltemplate.Execute(deleteOrphanedExternalSessionsTemplate, query)
		if err != nil {
			return err
		}
		res, err := dbSession.Exec(append([]any{querySQL}, query.GetArgs()...)...)
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
