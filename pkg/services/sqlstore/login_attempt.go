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
	bus.AddHandler("sql", GetUserLoginAttemptCount)
}

func CreateLoginAttempt(cmd *m.CreateLoginAttemptCommand) error {
	return inTransaction(func(sess *DBSession) error {
		loginAttempt := m.LoginAttempt{
			Username:  cmd.Username,
			IpAddress: cmd.IpAddress,
			Created:   getTimeNow(),
		}

		if _, err := sess.Insert(&loginAttempt); err != nil {
			return err
		}

		cmd.Result = loginAttempt

		return nil
	})
}

func GetUserLoginAttemptCount(query *m.GetUserLoginAttemptCountQuery) error {
	loginAttempt := new(m.LoginAttempt)
	total, err := x.
		Where("username = ?", query.Username).
		And("created >="+dialect.DateTimeFunc("?"), query.Since).
		Count(loginAttempt)

	if err != nil {
		return err
	}

	query.Result = total
	return nil
}

