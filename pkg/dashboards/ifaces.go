package dashboards

import "github.com/grafana/grafana/pkg/models"

// Store is a dashboard store.
type Store interface {
	// ValidateDashboardBeforeSave validates a dashboard before save.
	ValidateDashboardBeforeSave(orgID int64, dashboard *models.Dashboard, overwrite bool) (bool, error)
	GetProvisionedDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error)
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
	SaveProvisionedDashboard(cmd models.SaveDashboardCommand, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
}
