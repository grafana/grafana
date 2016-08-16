package sqlstore

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", SaveAlerts)
	bus.AddHandler("sql", HandleAlertsQuery)
	bus.AddHandler("sql", GetAlertById)
	bus.AddHandler("sql", DeleteAlertById)
	bus.AddHandler("sql", GetAllAlertQueryHandler)
	bus.AddHandler("sql", SetAlertState)
}

func GetAlertById(query *m.GetAlertByIdQuery) error {
	alert := m.Alert{}
	has, err := x.Id(query.Id).Get(&alert)
	if !has {
		return fmt.Errorf("could not find alert")
	}
	if err != nil {
		return err
	}

	query.Result = &alert
	return nil
}

func GetAllAlertQueryHandler(query *m.GetAllAlertsQuery) error {
	var alerts []*m.Alert
	err := x.Sql("select * from alert").Find(&alerts)
	if err != nil {
		return err
	}

	query.Result = alerts
	return nil
}

func DeleteAlertById(cmd *m.DeleteAlertCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		if _, err := sess.Exec("DELETE FROM alert WHERE id = ?", cmd.AlertId); err != nil {
			return err
		}

		return nil
	})
}

func HandleAlertsQuery(query *m.GetAlertsQuery) error {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT *
						from alert
						`)

	sql.WriteString(`WHERE org_id = ?`)
	params = append(params, query.OrgId)

	if query.DashboardId != 0 {
		sql.WriteString(` AND dashboard_id = ?`)
		params = append(params, query.DashboardId)
	}

	if query.PanelId != 0 {
		sql.WriteString(` AND panel_id = ?`)
		params = append(params, query.PanelId)
	}

	if len(query.State) > 0 {
		sql.WriteString(` AND (`)
		for i, v := range query.State {
			if i > 0 {
				sql.WriteString(" OR ")
			}
			sql.WriteString("state = ? ")
			params = append(params, strings.ToUpper(v))
		}
		sql.WriteString(")")
	}

	alerts := make([]*m.Alert, 0)
	if err := x.Sql(sql.String(), params...).Find(&alerts); err != nil {
		return err
	}

	query.Result = alerts
	return nil
}

func DeleteAlertDefinition(dashboardId int64, sess *xorm.Session) error {
	alerts := make([]*m.Alert, 0)
	sess.Where("dashboard_id = ?", dashboardId).Find(&alerts)

	for _, alert := range alerts {
		_, err := sess.Exec("DELETE FROM alert WHERE id = ? ", alert.Id)
		if err != nil {
			return err
		}

		sqlog.Debug("Alert deleted (due to dashboard deletion)", "name", alert.Name, "id", alert.Id)
	}

	return nil
}

func SaveAlerts(cmd *m.SaveAlertsCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		existingAlerts, err := GetAlertsByDashboardId2(cmd.DashboardId, sess)
		if err != nil {
			return err
		}

		if err := upsertAlerts(existingAlerts, cmd, sess); err != nil {
			return err
		}

		if err := deleteMissingAlerts(existingAlerts, cmd, sess); err != nil {
			return err
		}

		return nil
	})
}

func upsertAlerts(existingAlerts []*m.Alert, cmd *m.SaveAlertsCommand, sess *xorm.Session) error {
	for _, alert := range cmd.Alerts {
		update := false
		var alertToUpdate *m.Alert

		for _, k := range existingAlerts {
			if alert.PanelId == k.PanelId {
				update = true
				alert.Id = k.Id
				alertToUpdate = k
				break
			}
		}

		if update {
			if alertToUpdate.ContainsUpdates(alert) {
				alert.Updated = time.Now()
				alert.State = alertToUpdate.State
				_, err := sess.Id(alert.Id).Update(alert)
				if err != nil {
					return err
				}

				sqlog.Debug("Alert updated", "name", alert.Name, "id", alert.Id)
			}
		} else {
			alert.Updated = time.Now()
			alert.Created = time.Now()
			alert.State = m.AlertStatePending

			_, err := sess.Insert(alert)
			if err != nil {
				return err
			}

			sqlog.Debug("Alert inserted", "name", alert.Name, "id", alert.Id)
		}
	}

	return nil
}

func deleteMissingAlerts(alerts []*m.Alert, cmd *m.SaveAlertsCommand, sess *xorm.Session) error {
	for _, missingAlert := range alerts {
		missing := true

		for _, k := range cmd.Alerts {
			if missingAlert.PanelId == k.PanelId {
				missing = false
				break
			}
		}

		if missing {
			_, err := sess.Exec("DELETE FROM alert WHERE id = ?", missingAlert.Id)
			if err != nil {
				return err
			}

			sqlog.Debug("Alert deleted", "name", missingAlert.Name, "id", missingAlert.Id)
		}
	}

	return nil
}

func GetAlertsByDashboardId2(dashboardId int64, sess *xorm.Session) ([]*m.Alert, error) {
	alerts := make([]*m.Alert, 0)
	err := sess.Where("dashboard_id = ?", dashboardId).Find(&alerts)

	if err != nil {
		return []*m.Alert{}, err
	}

	return alerts, nil
}

func SetAlertState(cmd *m.SetAlertStateCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		alert := m.Alert{}

		if has, err := sess.Id(cmd.AlertId).Get(&alert); err != nil {
			return err
		} else if !has {
			return fmt.Errorf("Could not find alert")
		}

		alert.State = cmd.State
		alert.StateChanges += 1
		alert.NewStateDate = time.Now()

		sess.Id(alert.Id).Update(&alert)
		return nil
	})
}
