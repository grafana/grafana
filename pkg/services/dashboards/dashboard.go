package dashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

// DashboardService is a service for operating on dashboards.
//
//go:generate mockery --name DashboardService --structname FakeDashboardService --inpackage --filename dashboard_service_mock.go
type DashboardService interface {
	BuildSaveDashboardCommand(ctx context.Context, dto *SaveDashboardDTO, shouldValidateAlerts bool, validateProvisionedDashboard bool) (*models.SaveDashboardCommand, error)
	DeleteDashboard(ctx context.Context, dashboardId int64, orgId int64) error
	FindDashboards(ctx context.Context, query *models.FindPersistedDashboardsQuery) ([]DashboardSearchProjection, error)
	GetDashboard(ctx context.Context, query *models.GetDashboardQuery) error
	GetDashboardACLInfoList(ctx context.Context, query *models.GetDashboardACLInfoListQuery) error
	GetDashboards(ctx context.Context, query *models.GetDashboardsQuery) error
	GetDashboardTags(ctx context.Context, query *models.GetDashboardTagsQuery) error
	GetDashboardUIDById(ctx context.Context, query *models.GetDashboardRefByIdQuery) error
	HasAdminPermissionInDashboardsOrFolders(ctx context.Context, query *models.HasAdminPermissionInDashboardsOrFoldersQuery) error
	HasEditPermissionInFolders(ctx context.Context, query *models.HasEditPermissionInFoldersQuery) error
	ImportDashboard(ctx context.Context, dto *SaveDashboardDTO) (*models.Dashboard, error)
	MakeUserAdmin(ctx context.Context, orgID int64, userID, dashboardID int64, setViewAndEditPermissions bool) error
	SaveDashboard(ctx context.Context, dto *SaveDashboardDTO, allowUiUpdate bool) (*models.Dashboard, error)
	SearchDashboards(ctx context.Context, query *models.FindPersistedDashboardsQuery) error
	UpdateDashboardACL(ctx context.Context, uid int64, items []*models.DashboardACL) error
	DeleteACLByUser(ctx context.Context, userID int64) error
}

// PluginService is a service for operating on plugin dashboards.
type PluginService interface {
	GetDashboardsByPluginID(ctx context.Context, query *models.GetDashboardsByPluginIdQuery) error
}

// DashboardProvisioningService is a service for operating on provisioned dashboards.
//
//go:generate mockery --name DashboardProvisioningService --structname FakeDashboardProvisioning --inpackage --filename dashboard_provisioning_mock.go
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

// Store is a dashboard store.
//
//go:generate mockery --name Store --structname FakeDashboardStore --inpackage --filename store_mock.go
type Store interface {
	DeleteDashboard(ctx context.Context, cmd *models.DeleteDashboardCommand) error
	DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error
	FindDashboards(ctx context.Context, query *models.FindPersistedDashboardsQuery) ([]DashboardSearchProjection, error)
	GetDashboard(ctx context.Context, query *models.GetDashboardQuery) (*models.Dashboard, error)
	GetDashboardACLInfoList(ctx context.Context, query *models.GetDashboardACLInfoListQuery) error
	GetDashboardUIDById(ctx context.Context, query *models.GetDashboardRefByIdQuery) error
	GetDashboards(ctx context.Context, query *models.GetDashboardsQuery) error
	// GetDashboardsByPluginID retrieves dashboards identified by plugin.
	GetDashboardsByPluginID(ctx context.Context, query *models.GetDashboardsByPluginIdQuery) error
	GetDashboardTags(ctx context.Context, query *models.GetDashboardTagsQuery) error
	GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error)
	GetProvisionedDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error)
	GetProvisionedDataByDashboardUID(orgID int64, dashboardUID string) (*models.DashboardProvisioning, error)
	HasAdminPermissionInDashboardsOrFolders(ctx context.Context, query *models.HasAdminPermissionInDashboardsOrFoldersQuery) error
	HasEditPermissionInFolders(ctx context.Context, query *models.HasEditPermissionInFoldersQuery) error
	// SaveAlerts saves dashboard alerts.
	SaveAlerts(ctx context.Context, dashID int64, alerts []*models.Alert) error
	SaveDashboard(cmd models.SaveDashboardCommand) (*models.Dashboard, error)
	SaveProvisionedDashboard(cmd models.SaveDashboardCommand, provisioning *models.DashboardProvisioning) (*models.Dashboard, error)
	UnprovisionDashboard(ctx context.Context, id int64) error
	UpdateDashboardACL(ctx context.Context, uid int64, items []*models.DashboardACL) error
	// ValidateDashboardBeforeSave validates a dashboard before save.
	ValidateDashboardBeforeSave(dashboard *models.Dashboard, overwrite bool) (bool, error)
	DeleteACLByUser(context.Context, int64) error

	FolderStore
}

// FolderStore is a folder store.
//
//go:generate mockery --name FolderStore --structname FakeFolderStore --inpackage --filename folder_store_mock.go
type FolderStore interface {
	// GetFolderByTitle retrieves a folder by its title
	GetFolderByTitle(ctx context.Context, orgID int64, title string) (*models.Folder, error)
	// GetFolderByUID retrieves a folder by its UID
	GetFolderByUID(ctx context.Context, orgID int64, uid string) (*models.Folder, error)
	// GetFolderByID retrieves a folder by its ID
	GetFolderByID(ctx context.Context, orgID int64, id int64) (*models.Folder, error)
}
