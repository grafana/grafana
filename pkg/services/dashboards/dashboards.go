package dashboards

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"time"
)

type Repository interface {
	SaveDashboard(*SaveDashboardItem) error
}

type SaveDashboardItem struct {
	TitleLower string
	OrgId      int64
	Folder     string
	ModTime    time.Time
	UserId     int64
	Message    string
	Overwrite  bool
	Dashboard  *models.Dashboard
}

func SaveDashboard(json *SaveDashboardItem) error {
	dashboard := json.Dashboard

	if dashboard.Title == "" {
		return models.ErrDashboardTitleEmpty
	}

	validateAlertsCmd := alerting.ValidateDashboardAlertsCommand{
		OrgId:     json.OrgId,
		Dashboard: dashboard,
	}

	if err := bus.Dispatch(&validateAlertsCmd); err != nil {
		return models.ErrDashboardContainsInvalidAlertData
	}

	cmd := models.SaveDashboardCommand{
		Dashboard: dashboard.Data,
		Message:   json.Message,
		OrgId:     json.OrgId,
		Overwrite: json.Overwrite,
	}

	if !json.ModTime.IsZero() {
		cmd.UpdatedAt = json.ModTime
	}

	err := bus.Dispatch(&cmd)
	if err != nil {
		return err
	}

	alertCmd := alerting.UpdateDashboardAlertsCommand{
		OrgId:     json.OrgId,
		Dashboard: cmd.Result,
	}

	if err := bus.Dispatch(&alertCmd); err != nil {
		return err
	}

	return nil
}
