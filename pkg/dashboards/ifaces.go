package dashboards

import "github.com/grafana/grafana/pkg/models"

// Store is a dashboard store.
type Store interface {
	// ValidateDashboardBeforeSave validates a dashboard before save.
	ValidateDashboardBeforeSave(dashboard *models.Dashboard, overwrite bool) (bool, error)
	// GetFolderByTitle retrieves a dashboard by its title and is used by unified alerting
	GetFolderByTitle(orgID int64, title string) (*models.Dashboard, error)
	GetProvisionedDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error)
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
	SaveProvisionedDashboard(cmd models.SaveDashboardCommand, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	SaveDashboard(cmd models.SaveDashboardCommand) (*models.Dashboard, error)
	UpdateDashboardACL(uid int64, items []*models.DashboardAcl) error
	// SaveAlerts saves dashboard alerts.
	SaveAlerts(dashID int64, alerts []*models.Alert) error
}
