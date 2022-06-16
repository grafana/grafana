package dashboards

import (
	"context"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
)

//go:generate mockery --name DashboardService --structname MockDashboardService --inpackage --filename dashboard_service_mock.go
// DashboardService is a service for operating on dashboards.
type DashboardService interface {
	BuildPublicDashboardMetricRequest(context.Context, string, int64) (dtos.MetricRequest, error)
	BuildSaveDashboardCommand(context.Context, *SaveDashboardDTO, bool, bool) (*SaveDashboardCommand, error)
	DeleteDashboard(context.Context, int64, int64) error
	FindDashboards(context.Context, *models.FindPersistedDashboardsQuery) ([]DashboardSearchProjection, error)
	GetDashboard(context.Context, *GetDashboardQuery) error
	GetDashboardAclInfoList(context.Context, *models.GetDashboardAclInfoListQuery) error
	GetDashboards(context.Context, *GetDashboardsQuery) error
	GetDashboardTags(context.Context, *GetDashboardTagsQuery) error
	GetDashboardUIDById(context.Context, *GetDashboardRefByIdQuery) error
	GetPublicDashboard(context.Context, string) (*Dashboard, error)
	GetPublicDashboardConfig(context.Context, int64, string) (*PublicDashboardConfig, error)
	HasAdminPermissionInFolders(context.Context, *HasAdminPermissionInFoldersQuery) error
	HasEditPermissionInFolders(context.Context, *HasEditPermissionInFoldersQuery) error
	ImportDashboard(context.Context, *SaveDashboardDTO) (*Dashboard, error)
	MakeUserAdmin(context.Context, int64, int64, int64, bool) error
	SaveDashboard(context.Context, *SaveDashboardDTO, bool) (*Dashboard, error)
	SavePublicDashboardConfig(context.Context, *SavePublicDashboardConfigDTO) (*PublicDashboardConfig, error)
	SearchDashboards(context.Context, *models.FindPersistedDashboardsQuery) error
	UpdateDashboardACL(context.Context, int64, []*models.DashboardAcl) error
}

// PluginService is a service for operating on plugin dashboards.
type PluginService interface {
	GetDashboardsByPluginID(ctx context.Context, query *GetDashboardsByPluginIdQuery) error
}

//go:generate mockery --name DashboardProvisioningService --structname MockDashboardProvisioning --inpackage --filename dashboard_provisioning_mock.go
// DashboardProvisioningService is a service for operating on provisioned dashboards.
type DashboardProvisioningService interface {
	DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *DeleteOrphanedProvisionedDashboardsCommand) error
	DeleteProvisionedDashboard(ctx context.Context, dashboardID int64, orgID int64) error
	GetProvisionedDashboardData(name string) ([]*DashboardProvisioning, error)
	GetProvisionedDashboardDataByDashboardID(dashboardID int64) (*DashboardProvisioning, error)
	GetProvisionedDashboardDataByDashboardUID(orgID int64, dashboardUID string) (*DashboardProvisioning, error)
	SaveFolderForProvisionedDashboards(context.Context, *SaveDashboardDTO) (*Dashboard, error)
	SaveProvisionedDashboard(ctx context.Context, dto *SaveDashboardDTO, provisioning *DashboardProvisioning) (*Dashboard, error)
	UnprovisionDashboard(ctx context.Context, dashboardID int64) error
}

//go:generate mockery --name Store --structname MockDashboardStore --inpackage --filename store_mock.go
// Store is a dashboard store.
type Store interface {
	DeleteDashboard(ctx context.Context, cmd *DeleteDashboardCommand) error
	DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *DeleteOrphanedProvisionedDashboardsCommand) error
	FindDashboards(ctx context.Context, query *models.FindPersistedDashboardsQuery) ([]DashboardSearchProjection, error)
	GetDashboard(ctx context.Context, query *GetDashboardQuery) (*Dashboard, error)
	GetDashboardAclInfoList(ctx context.Context, query *models.GetDashboardAclInfoListQuery) error
	GetDashboardUIDById(ctx context.Context, query *GetDashboardRefByIdQuery) error
	GetDashboards(ctx context.Context, query *GetDashboardsQuery) error
	// GetDashboardsByPluginID retrieves dashboards identified by plugin.
	GetDashboardsByPluginID(ctx context.Context, query *GetDashboardsByPluginIdQuery) error
	GetDashboardTags(ctx context.Context, query *GetDashboardTagsQuery) error
	GetProvisionedDashboardData(name string) ([]*DashboardProvisioning, error)
	GetProvisionedDataByDashboardID(dashboardID int64) (*DashboardProvisioning, error)
	GetProvisionedDataByDashboardUID(orgID int64, dashboardUID string) (*DashboardProvisioning, error)
	GetPublicDashboardConfig(orgId int64, dashboardUid string) (*PublicDashboardConfig, error)
	GetPublicDashboard(uid string) (*PublicDashboard, *Dashboard, error)
	HasAdminPermissionInFolders(ctx context.Context, query *HasAdminPermissionInFoldersQuery) error
	HasEditPermissionInFolders(ctx context.Context, query *HasEditPermissionInFoldersQuery) error
	// SaveAlerts saves dashboard alerts.
	SaveAlerts(ctx context.Context, dashID int64, alerts []*models.Alert) error
	SaveDashboard(cmd SaveDashboardCommand) (*Dashboard, error)
	SaveProvisionedDashboard(cmd SaveDashboardCommand, provisioning *DashboardProvisioning) (*Dashboard, error)
	SavePublicDashboardConfig(cmd SavePublicDashboardConfigCommand) (*PublicDashboardConfig, error)
	UnprovisionDashboard(ctx context.Context, id int64) error
	UpdateDashboardACL(ctx context.Context, uid int64, items []*models.DashboardAcl) error
	// ValidateDashboardBeforeSave validates a dashboard before save.
	ValidateDashboardBeforeSave(dashboard *Dashboard, overwrite bool) (bool, error)

	FolderStore
}

//go:generate mockery --name FolderStore --structname MockFolderStore --inpackage --filename folder_store_mock.go
// FolderStore is a folder store.
type FolderStore interface {
	// GetFolderByTitle retrieves a folder by its title
	GetFolderByTitle(ctx context.Context, orgID int64, title string) (*Folder, error)
	// GetFolderByUID retrieves a folder by its UID
	GetFolderByUID(ctx context.Context, orgID int64, uid string) (*Folder, error)
	// GetFolderByID retrieves a folder by its ID
	GetFolderByID(ctx context.Context, orgID int64, id int64) (*Folder, error)
}
