package dashboards

import "github.com/grafana/grafana/pkg/models"

// Validator validates dashboards.
type Validator interface {
	// ValidateDashboardBeforeSave validates a dashboard before save.
	ValidateDashboardBeforeSave(orgID int64, dashboard *models.Dashboard, overwrite bool) (bool, error)
}

// ProvisionedDashboardGetter gets provisioned dashboards.
type ProvisionedDashboardGetter interface {
	GetProvisionedDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error)
}
