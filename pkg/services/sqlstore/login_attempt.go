package sqlstore

import (
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

var getTimeNow = time.Now

func init() {
	bus.AddHandler("sql", CreateLoginAttempt)
	bus.AddHandler("sql", DeleteOldLoginAttempts)
	bus.AddHandler("sql", GetUserLoginAttemptCount)
}

func CreateLoginAttempt(cmd *m.CreateLoginAttemptCommand) error {
	return inTransaction(func(sess *DBSession) error {
		loginAttempt := m.LoginAttempt{
			Username:  cmd.Username,
			IpAddress: cmd.IpAddress,
			Created:   getTimeNow().Unix(),
		}

		if _, err := sess.Insert(&loginAttempt); err != nil {
			return err
		}

		cmd.Result = loginAttempt

		return nil
	})
}

func DeleteOldLoginAttempts(cmd *m.DeleteOldLoginAttemptsCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var maxId int64
		sql := "SELECT max(id) as id FROM login_attempt WHERE created < ?"
		result, err := sess.Query(sql, cmd.OlderThan.Unix())

		if err != nil {
			return err
		}

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

func GetUserLoginAttemptCount(query *m.GetUserLoginAttemptCountQuery) error {
	loginAttempt := new(m.LoginAttempt)
	total, err := x.
		Where("username = ?", query.Username).
		And("created >= ?", query.Since.Unix()).
		Count(loginAttempt)

	if err != nil {
		return err
	}

	query.Result = total
	return nil
}

func toInt64(i interface{}) int64 {
	switch i.(type) {
	case []byte:
		n, _ := strconv.ParseInt(string(i.([]byte)), 10, 64)
		return n
	case int:
		return int64(i.(int))
	case int64:
		return i.(int64)
	}
	return 0
}
