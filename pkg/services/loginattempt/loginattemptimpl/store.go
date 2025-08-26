package loginattemptimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/loginattempt"
)

type xormStore struct {
	db  db.DB
	now func() time.Time
}

type store interface {
	CreateLoginAttempt(ctx context.Context, cmd CreateLoginAttemptCommand) (loginattempt.LoginAttempt, error)
	DeleteOldLoginAttempts(ctx context.Context, cmd DeleteOldLoginAttemptsCommand) (int64, error)
	DeleteLoginAttempts(ctx context.Context, cmd DeleteLoginAttemptsCommand) error
	GetUserLoginAttemptCount(ctx context.Context, query GetUserLoginAttemptCountQuery) (int64, error)
	GetIPLoginAttemptCount(ctx context.Context, query GetIPLoginAttemptCountQuery) (int64, error)
}

func (xs *xormStore) CreateLoginAttempt(ctx context.Context, cmd CreateLoginAttemptCommand) (result loginattempt.LoginAttempt, err error) {
	err = xs.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		loginAttempt := loginattempt.LoginAttempt{
			Username:  cmd.Username,
			IpAddress: cmd.IPAddress,
			Created:   xs.now().Unix(),
		}

		if _, err := sess.Insert(&loginAttempt); err != nil {
			return err
		}

		result = loginAttempt

		return nil
	})
	return result, err
}

func (xs *xormStore) DeleteOldLoginAttempts(ctx context.Context, cmd DeleteOldLoginAttemptsCommand) (int64, error) {
	var deletedRows int64
	err := xs.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		deleteResult, err := sess.Exec("DELETE FROM login_attempt WHERE created < ?", cmd.OlderThan.Unix())
		if err != nil {
			return err
		}

		deletedRows, err = deleteResult.RowsAffected()
		if err != nil {
			return err
		}
		return nil
	})
	return deletedRows, err
}

func (xs *xormStore) DeleteLoginAttempts(ctx context.Context, cmd DeleteLoginAttemptsCommand) error {
	return xs.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM login_attempt WHERE username = ?", cmd.Username)
		return err
	})
}

func (xs *xormStore) GetUserLoginAttemptCount(ctx context.Context, query GetUserLoginAttemptCountQuery) (int64, error) {
	var total int64
	err := xs.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		var queryErr error
		loginAttempt := new(loginattempt.LoginAttempt)
		total, queryErr = dbSession.
			Where("username = ?", query.Username).
			And("created >= ?", query.Since.Unix()).
			Count(loginAttempt)

		return queryErr
	})

	return total, err
}

func (xs *xormStore) GetIPLoginAttemptCount(ctx context.Context, query GetIPLoginAttemptCountQuery) (int64, error) {
	var total int64
	err := xs.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		var queryErr error
		loginAttempt := new(loginattempt.LoginAttempt)
		total, queryErr = dbSession.
			Where("ip_address = ?", query.IPAddress).
			And("created >= ?", query.Since.Unix()).
			Count(loginAttempt)

		if queryErr != nil {
			return queryErr
		}

		return nil
	})

	return total, err
}
