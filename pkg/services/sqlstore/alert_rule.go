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
}

func GetAlertById(query *m.GetAlertByIdQuery) error {
	alert := m.AlertRule{}
	has, err := x.Id(query.Id).Get(&alert)
	if !has {
		return fmt.Errorf("could not find alert")
	}
	if err != nil {
		return err
	}

	query.Result = alert
	return nil
}

func DeleteAlertById(cmd *m.DeleteAlertCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		if _, err := sess.Exec("DELETE FROM alert_rule WHERE id = ?", cmd.AlertId); err != nil {
			return err
		}

		return nil
	})
}

func HandleAlertsQuery(query *m.GetAlertsQuery) error {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT *
						from alert_rule
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

	alerts := make([]m.AlertRule, 0)
	if err := x.Sql(sql.String(), params...).Find(&alerts); err != nil {
		return err
	}

	query.Result = alerts
	return nil
}

func DeleteAlertDefinition(dashboardId int64, sess *xorm.Session) error {
	alerts := make([]m.AlertRule, 0)
	sess.Where("dashboard_id = ?", dashboardId).Find(&alerts)

	for _, alert := range alerts {
		_, err := sess.Exec("DELETE FROM alert_rule WHERE id = ? ", alert.Id)
		if err != nil {
			return err
		}

		if err := SaveAlertChange("DELETED", alert, sess); err != nil {
			return err
		}
	}

	return nil
}

func SaveAlerts(cmd *m.SaveAlertsCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		alerts, err := GetAlertsByDashboardId2(cmd.DashboardId, sess)
		if err != nil {
			return err
		}

		upsertAlerts(alerts, cmd.Alerts, sess)
		deleteMissingAlerts(alerts, cmd.Alerts, sess)

		return nil
	})
}

func upsertAlerts(alerts []m.AlertRule, posted []m.AlertRule, sess *xorm.Session) error {
	for _, alert := range posted {
		update := false
		var alertToUpdate m.AlertRule

		for _, k := range alerts {
			if alert.PanelId == k.PanelId {
				update = true
				alert.Id = k.Id
				alertToUpdate = k
			}
		}

		if update {
			if alertToUpdate.Equals(alert) {
				alert.Updated = time.Now()
				alert.State = alertToUpdate.State
				_, err := sess.Id(alert.Id).Update(&alert)
				if err != nil {
					return err
				}

				SaveAlertChange("UPDATED", alert, sess)
			}

		} else {
			alert.Updated = time.Now()
			alert.Created = time.Now()
			alert.State = "OK"
			_, err := sess.Insert(&alert)
			if err != nil {
				return err
			}
			SaveAlertChange("CREATED", alert, sess)
		}
	}

	return nil
}

func deleteMissingAlerts(alerts []m.AlertRule, posted []m.AlertRule, sess *xorm.Session) error {
	for _, missingAlert := range alerts {
		missing := true

		for _, k := range posted {
			if missingAlert.PanelId == k.PanelId {
				missing = false
			}
		}

		if missing {
			_, err := sess.Exec("DELETE FROM alert_rule WHERE id = ?", missingAlert.Id)
			if err != nil {
				return err
			}

			err = SaveAlertChange("DELETED", missingAlert, sess)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func GetAlertsByDashboardId2(dashboardId int64, sess *xorm.Session) ([]m.AlertRule, error) {
	alerts := make([]m.AlertRule, 0)
	err := sess.Where("dashboard_id = ?", dashboardId).Find(&alerts)

	if err != nil {
		return []m.AlertRule{}, err
	}

	return alerts, nil
}
