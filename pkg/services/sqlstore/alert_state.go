package sqlstore

import (
	"fmt"
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", SetNewAlertState)
	bus.AddHandler("sql", GetAlertStateLogByAlertId)
	bus.AddHandler("sql", GetLastAlertStateQuery)
}

func GetLastAlertStateQuery(cmd *m.GetLastAlertStateQuery) error {
	states := make([]m.AlertState, 0)

	if err := x.Where("alert_id = ? and org_id = ? ", cmd.AlertId, cmd.OrgId).Desc("created").Find(&states); err != nil {
		return err
	}

	if len(states) == 0 {
		cmd.Result = nil
		return nil
	}

	cmd.Result = &states[0]
	return nil
}

func SetNewAlertState(cmd *m.UpdateAlertStateCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		if !cmd.IsValidState() {
			return fmt.Errorf("new state is invalid")
		}

		alert := m.Alert{}
		has, err := sess.Id(cmd.AlertId).Get(&alert)
		if err != nil {
			return err
		}

		if !has {
			return fmt.Errorf("Could not find alert")
		}

		alert.State = cmd.NewState
		sess.Id(alert.Id).Update(&alert)

		alertState := m.AlertState{
			AlertId:         cmd.AlertId,
			OrgId:           cmd.OrgId,
			NewState:        cmd.NewState,
			Info:            cmd.Info,
			Created:         time.Now(),
			TriggeredAlerts: cmd.TriggeredAlerts,
		}

		sess.Insert(&alertState)

		cmd.Result = &alert
		return nil
	})
}

func GetAlertStateLogByAlertId(cmd *m.GetAlertsStateQuery) error {
	states := make([]m.AlertState, 0)

	if err := x.Where("alert_id = ?", cmd.AlertId).Desc("created").Find(&states); err != nil {
		return err
	}

	cmd.Result = &states
	return nil
}
