package loginattemptimpl

import (
	"context"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/loginattempt"
)

type xormStore struct {
	db  db.DB
	now func() time.Time
}

type store interface {
	CreateLoginAttempt(ctx context.Context, cmd CreateLoginAttemptCommand) error
	DeleteOldLoginAttempts(ctx context.Context, cmd DeleteOldLoginAttemptsCommand) (int64, error)
	GetUserLoginAttemptCount(ctx context.Context, query GetUserLoginAttemptCountQuery) (int64, error)
}

func (xs *xormStore) CreateLoginAttempt(ctx context.Context, cmd CreateLoginAttemptCommand) error {
	return xs.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		loginAttempt := loginattempt.LoginAttempt{
			Username:  cmd.Username,
			IpAddress: cmd.IpAddress,
			Created:   xs.now().Unix(),
		}

		if _, err := sess.Insert(&loginAttempt); err != nil {
			return err
		}

		cmd.Result = loginAttempt

		return nil
	})
}

func (xs *xormStore) DeleteOldLoginAttempts(ctx context.Context, cmd DeleteOldLoginAttemptsCommand) (int64, error) {
	var deletedRows int64
	err := xs.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var maxId int64
		sql := "SELECT max(id) as id FROM login_attempt WHERE created < ?"
		result, err := sess.Query(sql, cmd.OlderThan.Unix())
		if err != nil {
			return err
		}
		if len(result) == 0 || result[0] == nil {
			return nil
		}

		// TODO: why don't we know the type of ID?
		maxId = toInt64(result[0]["id"])

		if maxId == 0 {
			return nil
		}

		sql = "DELETE FROM login_attempt WHERE id <= ?"

		deleteResult, err := sess.Exec(sql, maxId)
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

func (xs *xormStore) GetUserLoginAttemptCount(ctx context.Context, query GetUserLoginAttemptCountQuery) (int64, error) {
	var total int64
	err := xs.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		var queryErr error
		loginAttempt := new(loginattempt.LoginAttempt)
		total, queryErr = dbSession.
			Where("username = ?", query.Username).
			And("created >= ?", query.Since.Unix()).
			Count(loginAttempt)

		if queryErr != nil {
			return queryErr
		}

		return nil
	})

	return total, err
}

func toInt64(i interface{}) int64 {
	switch i := i.(type) {
	case []byte:
		n, _ := strconv.ParseInt(string(i), 10, 64)
		return n
	case int:
		return int64(i)
	case int64:
		return i
	}
	return 0
}
