package sqlstore

import (
	"fmt"
	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"time"
)

func init() {
	bus.AddHandler("sql", SetNewAlertState)
	bus.AddHandler("sql", GetAlertStateLogByAlertId)
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

		log := m.AlertStateLog{
			AlertId:  cmd.AlertId,
			OrgId:    cmd.AlertId,
			NewState: cmd.NewState,
			Info:     cmd.Info,
			Created:  time.Now(),
		}

		sess.Insert(&log)

		cmd.Result = &alert
		return nil
	})
}

func GetAlertStateLogByAlertId(cmd *m.GetAlertsStateLogCommand) error {
	alertLogs := make([]m.AlertStateLog, 0)

	if err := x.Where("alert_id = ?", cmd.AlertId).Desc("created").Find(&alertLogs); err != nil {
		return err
	}

	cmd.Result = &alertLogs
	return nil
}
