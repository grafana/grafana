package sqlstore

import (
	"fmt"
	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", SaveAlerts)
	bus.AddHandler("sql", GetAllAlertsForOrg)
	bus.AddHandler("sql", GetAlertById)
	bus.AddHandler("sql", GetAlertsByDashboardId)
	bus.AddHandler("sql", GetAlertsByDashboardAndPanelId)
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

func GetAllAlertsForOrg(query *m.GetAlertsQuery) error {
	alerts := make([]m.AlertRule, 0)
	if err := x.Where("org_id = ?", query.OrgId).Find(&alerts); err != nil {
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

func alertIsDifferent(rule1, rule2 m.AlertRule) bool {
	result := false

	result = result || rule1.Aggregator != rule2.Aggregator
	result = result || rule1.CritLevel != rule2.CritLevel
	result = result || rule1.WarnLevel != rule2.WarnLevel
	result = result || rule1.Query != rule2.Query
	result = result || rule1.QueryRefId != rule2.QueryRefId
	result = result || rule1.Interval != rule2.Interval
	result = result || rule1.Title != rule2.Title
	result = result || rule1.Description != rule2.Description
	result = result || rule1.QueryRange != rule2.QueryRange
	//don't compare .State! That would be insane.

	return result
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

func upsertAlerts(alerts []m.AlertRule, posted *[]m.AlertRule, sess *xorm.Session) error {
	for _, alert := range *posted {
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
			if alertIsDifferent(alertToUpdate, alert) {
				alert.State = alertToUpdate.State
				_, err := sess.Id(alert.Id).Update(&alert)
				if err != nil {
					return err
				}

				SaveAlertChange("UPDATED", alert, sess)
			}

		} else {
			_, err := sess.Insert(&alert)
			if err != nil {
				return err
			}
			SaveAlertChange("CREATED", alert, sess)
		}
	}

	return nil
}

func deleteMissingAlerts(alerts []m.AlertRule, posted *[]m.AlertRule, sess *xorm.Session) error {
	for _, missingAlert := range alerts {
		missing := true

		for _, k := range *posted {
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

func GetAlertsByDashboardId(cmd *m.GetAlertsForDashboardQuery) error {
	alerts := make([]m.AlertRule, 0)
	err := x.Where("dashboard_id = ?", cmd.DashboardId).Find(&alerts)

	if err != nil {
		return err
	}

	cmd.Result = alerts
	return nil
}

func GetAlertsByDashboardAndPanelId(cmd *m.GetAlertForPanelQuery) error {
	alerts := make([]m.AlertRule, 0)
	err := x.Where("dashboard_id = ? and panel_id = ?", cmd.DashboardId, cmd.PanelId).Find(&alerts)

	if err != nil {
		return err
	}

	if len(alerts) != 1 {
		return err
	}
	cmd.Result = alerts[0]
	return nil
}
