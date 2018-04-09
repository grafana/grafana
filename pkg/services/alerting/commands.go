package alerting

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("alerting", updateDashboardAlerts)
	bus.AddHandler("alerting", validateDashboardAlerts)
}

func validateDashboardAlerts(cmd *m.ValidateDashboardAlertsCommand) error {
	extractor := NewDashAlertExtractor(cmd.Dashboard, cmd.OrgId)

	return extractor.ValidateAlerts()
}

func updateDashboardAlerts(cmd *m.UpdateDashboardAlertsCommand) error {
	saveAlerts := m.SaveAlertsCommand{
		OrgId:       cmd.OrgId,
		UserId:      cmd.UserId,
		DashboardId: cmd.Dashboard.Id,
	}

	extractor := NewDashAlertExtractor(cmd.Dashboard, cmd.OrgId)

	alerts, err := extractor.GetAlerts()
	if err != nil {
		return err
	}

	saveAlerts.Alerts = alerts

	return bus.Dispatch(&saveAlerts)
}
