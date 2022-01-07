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
}

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
