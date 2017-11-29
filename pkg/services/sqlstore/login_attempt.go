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

