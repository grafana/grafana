package dashboards

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

type Repository interface {
	SaveDashboard(*SaveDashboardItem) (*models.Dashboard, error)
}

var repositoryInstance Repository

func GetRepository() Repository {
	return repositoryInstance
}

func SetRepository(rep Repository) {
	repositoryInstance = rep
}

type SaveDashboardItem struct {
	TitleLower string
	OrgId      int64
	Folder     string
	UpdatedAt  time.Time
	UserId     int64
	Message    string
	Overwrite  bool
	Dashboard  *models.Dashboard
}

type DashboardRepository struct{}

func (dr *DashboardRepository) SaveDashboard(json *SaveDashboardItem) (*models.Dashboard, error) {
	dashboard := json.Dashboard

	if dashboard.Title == "" {
		return nil, models.ErrDashboardTitleEmpty
	}

	validateAlertsCmd := alerting.ValidateDashboardAlertsCommand{
		OrgId:     json.OrgId,
		Dashboard: dashboard,
	}

	if err := bus.Dispatch(&validateAlertsCmd); err != nil {
		return nil, models.ErrDashboardContainsInvalidAlertData
	}

	cmd := models.SaveDashboardCommand{
		Dashboard: dashboard.Data,
		Message:   json.Message,
		OrgId:     json.OrgId,
		Overwrite: json.Overwrite,
		UserId:    json.UserId,
	}

	if !json.UpdatedAt.IsZero() {
		cmd.UpdatedAt = json.UpdatedAt
	}

	err := bus.Dispatch(&cmd)
	if err != nil {
		return nil, err
	}

	alertCmd := alerting.UpdateDashboardAlertsCommand{
		OrgId:     json.OrgId,
		UserId:    json.UserId,
		Dashboard: cmd.Result,
	}

	if err := bus.Dispatch(&alertCmd); err != nil {
		return nil, models.ErrDashboardFailedToUpdateAlertData
	}

	return cmd.Result, nil
}
