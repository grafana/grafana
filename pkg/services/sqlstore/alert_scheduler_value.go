package sqlstore

import (
	"github.com/go-xorm/xorm"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", UpdateAlertSchedulerValue)
	bus.AddHandler("sql", GetAlertSchedulerValue)
}

func GetAlertSchedulerValue(query *m.GetAlertSchedulerValueQuery) error {
	rawSql := "SELECT value from alert_scheduler_value where id=?"
	results, err := x.Query(rawSql, query.Id)

	if err != nil {
		return err
	}

	if len(results) == 0 {
		return nil
	}

	query.Result = string(results[0]["value"])
	return nil
}

func UpdateAlertSchedulerValue(cmd *m.UpdateAlertSchedulerValueCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		entity := m.AlertSchedulerValue{
			Id:    cmd.Id,
			Value: cmd.Value,
		}

		affected, err := sess.Update(&entity)
		if err == nil && affected == 0 {
			_, err = sess.Insert(&entity)
		}

		return err
	})
}
