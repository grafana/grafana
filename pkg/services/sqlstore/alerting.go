package sqlstore

import (
	"fmt"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", SaveAlerts)
}

func SaveAlerts(cmd *m.SaveAlertsCommand) error {
	//this function should be refactored

	fmt.Printf("Saving alerts for dashboard %v\n", cmd.DashboardId)

	alerts, err := GetAlertsByDashboardId(cmd.DashboardId)
	if err != nil {
		return err
	}

	for _, alert := range *cmd.Alerts {
		update := false

		for _, k := range alerts {
			if alert.PanelId == k.PanelId {
				update = true
				alert.Id = k.Id
			}
		}

		if update {
			_, err = x.Id(alert.Id).Update(&alert)
			if err != nil {
				return err
			}
		} else {
			_, err = x.Insert(&alert)
			if err != nil {
				return err
			}
		}
	}

	for _, missingAlert := range alerts {
		missing := true

		for _, k := range *cmd.Alerts {
			if missingAlert.PanelId == k.PanelId {
				missing = false
			}
		}

		if missing {
			_, err = x.Exec("DELETE FROM alert_rule WHERE id = ?", missingAlert.Id)
			if err != nil {
				return err
			}

			if err != nil {
				return err
			}
		}
	}

	return nil
}

func GetAlertsByDashboardId(dashboardId int64) ([]m.AlertRule, error) {
	alerts := make([]m.AlertRule, 0)
	err := x.Where("dashboard_id = ?", dashboardId).Find(&alerts)

	if err != nil {
		return []m.AlertRule{}, err
	}

	return alerts, nil
}

func GetAlertsByDashboardAndPanelId(dashboardId, panelId int64) (m.AlertRule, error) {
	// this code should be refactored!!
	// uniqueness should be garanted!

	alerts := make([]m.AlertRule, 0)
	err := x.Where("dashboard_id = ? and panel_id = ?", dashboardId, panelId).Find(&alerts)

	if err != nil {
		return m.AlertRule{}, err
	}

	if len(alerts) != 1 {
		return m.AlertRule{}, err
	}

	return alerts[0], nil
}
