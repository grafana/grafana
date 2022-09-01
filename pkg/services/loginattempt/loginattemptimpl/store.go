package loginattemptimpl

import (
	"context"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type xormStore struct {
	db  db.DB
	now func() time.Time
}

type store interface {
	CreateLoginAttempt(context.Context, *models.CreateLoginAttemptCommand) error
	DeleteOldLoginAttempts(context.Context, *models.DeleteOldLoginAttemptsCommand) error
	GetUserLoginAttemptCount(context.Context, *models.GetUserLoginAttemptCountQuery) error
}

func (xs *xormStore) CreateLoginAttempt(ctx context.Context, cmd *models.CreateLoginAttemptCommand) error {
	return xs.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		loginAttempt := models.LoginAttempt{
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

func (xs *xormStore) DeleteOldLoginAttempts(ctx context.Context, cmd *models.DeleteOldLoginAttemptsCommand) error {
	return xs.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
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

		if result, err := sess.Exec(sql, maxId); err != nil {
			return err
		} else if cmd.DeletedRows, err = result.RowsAffected(); err != nil {
			return err
		}

		return nil
	})
}

func (xs *xormStore) GetUserLoginAttemptCount(ctx context.Context, query *models.GetUserLoginAttemptCountQuery) error {
	return xs.db.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		loginAttempt := new(models.LoginAttempt)
		total, err := dbSession.
			Where("username = ?", query.Username).
			And("created >= ?", query.Since.Unix()).
			Count(loginAttempt)

		if err != nil {
			return err
		}

		query.Result = total
		return nil
	})
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
