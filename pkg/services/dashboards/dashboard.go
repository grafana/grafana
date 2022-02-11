package dashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

// DashboardService is a service for operating on dashboards.
type DashboardService interface {
	SaveDashboard(ctx context.Context, dto *SaveDashboardDTO, allowUiUpdate bool) (*models.Dashboard, error)
	ImportDashboard(ctx context.Context, dto *SaveDashboardDTO) (*models.Dashboard, error)
	DeleteDashboard(ctx context.Context, dashboardId int64, orgId int64) error
	MakeUserAdmin(ctx context.Context, orgID int64, userID, dashboardID int64, setViewAndEditPermissions bool) error
	BuildSaveDashboardCommand(ctx context.Context, dto *SaveDashboardDTO, shouldValidateAlerts bool, validateProvisionedDashboard bool) (*models.SaveDashboardCommand, error)
	UpdateDashboardACL(ctx context.Context, uid int64, items []*models.DashboardAcl) error
}

//go:generate mockery --name DashboardProvisioningService --structname FakeDashboardProvisioning --inpackage --filename dashboard_provisioning_mock.go
// DashboardProvisioningService is a service for operating on provisioned dashboards.
type DashboardProvisioningService interface {
	SaveProvisionedDashboard(ctx context.Context, dto *SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	SaveFolderForProvisionedDashboards(context.Context, *SaveDashboardDTO) (*models.Dashboard, error)
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
	GetProvisionedDashboardDataByDashboardUID(orgID int64, dashboardUID string) (*models.DashboardProvisioning, error)
	GetProvisionedDashboardDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error)
	UnprovisionDashboard(ctx context.Context, dashboardID int64) error
	DeleteProvisionedDashboard(ctx context.Context, dashboardID int64, orgID int64) error
}

//go:generate mockery --name Store --structname FakeDashboardStore --output database --outpkg database --filename database_mock.go
// Store is a dashboard store.
type Store interface {
	// ValidateDashboardBeforeSave validates a dashboard before save.
	ValidateDashboardBeforeSave(dashboard *models.Dashboard, overwrite bool) (bool, error)
	// GetFolderByTitle retrieves a dashboard by its title and is used by unified alerting
	GetFolderByTitle(orgID int64, title string) (*models.Dashboard, error)
	GetProvisionedDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error)
	GetProvisionedDataByDashboardUID(orgID int64, dashboardUID string) (*models.DashboardProvisioning, error)
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
	SaveProvisionedDashboard(cmd models.SaveDashboardCommand, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	SaveDashboard(cmd models.SaveDashboardCommand) (*models.Dashboard, error)
	UpdateDashboardACL(ctx context.Context, uid int64, items []*models.DashboardAcl) error
	// SaveAlerts saves dashboard alerts.
	SaveAlerts(ctx context.Context, dashID int64, alerts []*models.Alert) error
	UnprovisionDashboard(ctx context.Context, id int64) error
}
