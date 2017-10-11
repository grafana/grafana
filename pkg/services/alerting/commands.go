package alerting

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

type UpdateDashboardAlertsCommand struct {
	UserId    int64
	OrgId     int64
	Dashboard *m.Dashboard
}

type ValidateDashboardAlertsCommand struct {
	UserId    int64
	OrgId     int64
	Dashboard *m.Dashboard
}

func init() {
	bus.AddHandler("alerting", updateDashboardAlerts)
	bus.AddHandler("alerting", validateDashboardAlerts)
}

func validateDashboardAlerts(cmd *ValidateDashboardAlertsCommand) error {
	extractor := NewDashAlertExtractor(cmd.Dashboard, cmd.OrgId)

	if _, err := extractor.GetAlerts(); err != nil {
		return err
	}

	return nil
}

func updateDashboardAlerts(cmd *UpdateDashboardAlertsCommand) error {
	saveAlerts := m.SaveAlertsCommand{
		OrgId:       cmd.OrgId,
		UserId:      cmd.UserId,
		DashboardId: cmd.Dashboard.Id,
	}

	extractor := NewDashAlertExtractor(cmd.Dashboard, cmd.OrgId)

	if alerts, err := extractor.GetAlerts(); err != nil {
		return err
	} else {
		saveAlerts.Alerts = alerts
	}

	if err := bus.Dispatch(&saveAlerts); err != nil {
		return err
	}

	return nil
}
