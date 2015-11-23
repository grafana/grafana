package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetAlerts)
	bus.AddHandler("sql", GetAlertById)
	bus.AddHandler("sql", DeleteAlert)
	bus.AddHandler("sql", AddAlert)
}

func GetAlerts(query *m.GetAlertsQuery) error {
	sess := x.Limit(100, 0).Where("org_id=?", query.OrgId).Asc("id")

	query.Result = make([]*m.Alert, 0)
	return sess.Find(&query.Result)
}

func DeleteAlert(cmd *m.DeleteAlertCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM alert WHERE id=? and org_id=?"
		_, err := sess.Exec(rawSql, cmd.Id, cmd.OrgId)
		return err
	})
}

func AddAlert(cmd *m.AddAlertCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		t := m.Alert{
			OrgId:     cmd.OrgId,
			Freq:      cmd.Freq,
			Expr:      cmd.Expr,
			LevelWarn: cmd.LevelWarn,
			LevelCrit: cmd.LevelCrit,
			Created:   time.Now(),
			Updated:   time.Now(),
		}

		if _, err := sess.Insert(&t); err != nil {
			return err
		}
		cmd.Result = &t
		return nil
	})
}

func GetAlertById(query *m.GetAlertByIdQuery) error {
	var Alert m.Alert
	has, err := x.Id(query.Id).Get(&Alert)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrInvalidAlert
	}

	query.Result = &Alert
	return nil
}
