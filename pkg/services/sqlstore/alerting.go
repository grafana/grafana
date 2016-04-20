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
	fmt.Printf("Saving alerts for dashboard %v\n", cmd.DashboardId)

	for _, alert := range *cmd.Alerts {
		_, err := x.Insert(&alert)
		if err != nil {
			return err
		}
	}

	return nil
}

func GetAlertsByDashboard(dashboardId, panelId int64) (m.Alert, error) {
	// this code should be refactored!!
	// uniqueness should be garanted!

	alerts := make([]m.Alert, 0)
	err := x.Where("dashboard_id = ? and panel_id = ?", dashboardId, panelId).Find(&alerts)

	if err != nil {
		return m.Alert{}, err
	}

	return alerts[0], nil
}
