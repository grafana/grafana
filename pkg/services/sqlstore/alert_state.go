package sqlstore

import (
	"fmt"
	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", SetNewAlertState)
}

func SetNewAlertState(cmd *m.UpdateAlertStateCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		if !cmd.IsValidState() {
			return fmt.Errorf("new state is invalid")
		}

		alert := m.AlertRule{}
		has, err := sess.Id(cmd.AlertId).Get(&alert)
		if !has {
			return fmt.Errorf("Could not find alert")
		}

		if err != nil {
			return err
		}

		alert.State = cmd.NewState
		sess.Id(alert.Id).Update(&alert)
		//update alert

		//insert alert state log

		cmd.Result = &alert
		return nil
	})
}
