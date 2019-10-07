package alerting

import (
	"context"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("alerting", updateDashboardAlerts)
	bus.AddHandlerCtx("alerting", ValidateDashboardAlerts)
}

func ValidateDashboardAlerts(ctx context.Context, cmd *models.ValidateDashboardAlertsCommand) error {
	extractor := NewDashAlertExtractor(cmd.Dashboard, cmd.OrgId, cmd.User)

	return extractor.ValidateAlerts()
}

func updateDashboardAlerts(cmd *models.UpdateDashboardAlertsCommand) error {
	saveAlerts := models.SaveAlertsCommand{
		OrgId:       cmd.OrgId,
		UserId:      cmd.User.UserId,
		DashboardId: cmd.Dashboard.Id,
	}

	extractor := NewDashAlertExtractor(cmd.Dashboard, cmd.OrgId, cmd.User)

	alerts, err := extractor.GetAlerts()
	if err != nil {
		return err
	}

	saveAlerts.Alerts = alerts

	return bus.Dispatch(&saveAlerts)
}
