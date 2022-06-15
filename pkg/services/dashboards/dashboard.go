package dashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
)

//go:generate mockery --name DashboardService --structname FakeDashboardService --inpackage --filename dashboard_service_mock.go
// DashboardService is a service for operating on dashboards.
type DashboardService interface {
	BuildPublicDashboardMetricRequest(ctx context.Context, dashboard *models.Dashboard, publicDashboard *models.PublicDashboard, panelId int64) (dtos.MetricRequest, error)
	BuildSaveDashboardCommand(ctx context.Context, dto *SaveDashboardDTO, shouldValidateAlerts bool, validateProvisionedDashboard bool) (*models.SaveDashboardCommand, error)
	DeleteDashboard(ctx context.Context, dashboardId int64, orgId int64) error
	FindDashboards(ctx context.Context, query *models.FindPersistedDashboardsQuery) ([]DashboardSearchProjection, error)
	GetDashboard(ctx context.Context, query *models.GetDashboardQuery) error
	GetDashboardAclInfoList(ctx context.Context, query *models.GetDashboardAclInfoListQuery) error
	GetDashboards(ctx context.Context, query *models.GetDashboardsQuery) error
	GetDashboardTags(ctx context.Context, query *models.GetDashboardTagsQuery) error
	GetDashboardUIDById(ctx context.Context, query *models.GetDashboardRefByIdQuery) error
	GetPublicDashboard(ctx context.Context, publicDashboardUid string) (*models.Dashboard, error)
	GetPublicDashboardConfig(ctx context.Context, orgId int64, dashboardUid string) (*models.PublicDashboard, error)
	HasAdminPermissionInFolders(ctx context.Context, query *models.HasAdminPermissionInFoldersQuery) error
	HasEditPermissionInFolders(ctx context.Context, query *models.HasEditPermissionInFoldersQuery) error
	ImportDashboard(ctx context.Context, dto *SaveDashboardDTO) (*models.Dashboard, error)
	MakeUserAdmin(ctx context.Context, orgID int64, userID, dashboardID int64, setViewAndEditPermissions bool) error
	SaveDashboard(ctx context.Context, dto *SaveDashboardDTO, allowUiUpdate bool) (*models.Dashboard, error)
	SavePublicDashboardConfig(ctx context.Context, dto *SavePublicDashboardConfigDTO) (*models.PublicDashboard, error)
	SearchDashboards(ctx context.Context, query *models.FindPersistedDashboardsQuery) error
	UpdateDashboardACL(ctx context.Context, uid int64, items []*models.DashboardAcl) error
}

// PluginService is a service for operating on plugin dashboards.
type PluginService interface {
	GetDashboardsByPluginID(ctx context.Context, query *models.GetDashboardsByPluginIdQuery) error
}

//go:generate mockery --name DashboardProvisioningService --structname FakeDashboardProvisioning --inpackage --filename dashboard_provisioning_mock.go
// DashboardProvisioningService is a service for operating on provisioned dashboards.
type DashboardProvisioningService interface {
	DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error
	DeleteProvisionedDashboard(ctx context.Context, dashboardID int64, orgID int64) error
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
	GetProvisionedDashboardDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error)
	GetProvisionedDashboardDataByDashboardUID(orgID int64, dashboardUID string) (*models.DashboardProvisioning, error)
	SaveFolderForProvisionedDashboards(context.Context, *SaveDashboardDTO) (*models.Dashboard, error)
	SaveProvisionedDashboard(ctx context.Context, dto *SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	UnprovisionDashboard(ctx context.Context, dashboardID int64) error
}

//go:generate mockery --name Store --structname FakeDashboardStore --inpackage --filename store_mock.go
// Store is a dashboard store.
type Store interface {
	DeleteDashboard(ctx context.Context, cmd *models.DeleteDashboardCommand) error
	DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error
	FindDashboards(ctx context.Context, query *models.FindPersistedDashboardsQuery) ([]DashboardSearchProjection, error)
	GetDashboard(ctx context.Context, query *models.GetDashboardQuery) (*models.Dashboard, error)
	GetDashboardAclInfoList(ctx context.Context, query *models.GetDashboardAclInfoListQuery) error
	GetDashboardUIDById(ctx context.Context, query *models.GetDashboardRefByIdQuery) error
	GetDashboards(ctx context.Context, query *models.GetDashboardsQuery) error
	// GetDashboardsByPluginID retrieves dashboards identified by plugin.
	GetDashboardsByPluginID(ctx context.Context, query *models.GetDashboardsByPluginIdQuery) error
	GetDashboardTags(ctx context.Context, query *models.GetDashboardTagsQuery) error
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
	GetProvisionedDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error)
	GetProvisionedDataByDashboardUID(orgID int64, dashboardUID string) (*models.DashboardProvisioning, error)
	GetPublicDashboardConfig(orgId int64, dashboardUid string) (*models.PublicDashboard, error)
	GetPublicDashboard(ctx context.Context, uid string) (*models.PublicDashboard, *models.Dashboard, error)
	HasAdminPermissionInFolders(ctx context.Context, query *models.HasAdminPermissionInFoldersQuery) error
	HasEditPermissionInFolders(ctx context.Context, query *models.HasEditPermissionInFoldersQuery) error
	// SaveAlerts saves dashboard alerts.
	SaveAlerts(ctx context.Context, dashID int64, alerts []*models.Alert) error
	SaveDashboard(cmd models.SaveDashboardCommand) (*models.Dashboard, error)
	SaveProvisionedDashboard(cmd models.SaveDashboardCommand, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	SavePublicDashboardConfig(cmd models.SavePublicDashboardConfigCommand) (*models.PublicDashboard, error)
	UnprovisionDashboard(ctx context.Context, id int64) error
	UpdateDashboardACL(ctx context.Context, uid int64, items []*models.DashboardAcl) error
	// ValidateDashboardBeforeSave validates a dashboard before save.
	ValidateDashboardBeforeSave(dashboard *models.Dashboard, overwrite bool) (bool, error)

	FolderStore
}

//go:generate mockery --name FolderStore --structname FakeFolderStore --inpackage --filename folder_store_mock.go
// FolderStore is a folder store.
type FolderStore interface {
	// GetFolderByTitle retrieves a folder by its title
	GetFolderByTitle(ctx context.Context, orgID int64, title string) (*models.Folder, error)
	// GetFolderByUID retrieves a folder by its UID
	GetFolderByUID(ctx context.Context, orgID int64, uid string) (*models.Folder, error)
	// GetFolderByID retrieves a folder by its ID
	GetFolderByID(ctx context.Context, orgID int64, id int64) (*models.Folder, error)
}
