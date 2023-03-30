package dashboards

import (
	"context"

	alertmodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/search/model"
)

// DashboardService is a service for operating on dashboards.
//
//go:generate mockery --name DashboardService --structname FakeDashboardService --inpackage --filename dashboard_service_mock.go
type DashboardService interface {
	BuildSaveDashboardCommand(ctx context.Context, dto *SaveDashboardDTO, shouldValidateAlerts bool, validateProvisionedDashboard bool) (*SaveDashboardCommand, error)
	DeleteDashboard(ctx context.Context, dashboardId int64, orgId int64) error
	FindDashboards(ctx context.Context, query *FindPersistedDashboardsQuery) ([]DashboardSearchProjection, error)
	GetDashboard(ctx context.Context, query *GetDashboardQuery) (*Dashboard, error)
	GetDashboardACLInfoList(ctx context.Context, query *GetDashboardACLInfoListQuery) ([]*DashboardACLInfoDTO, error)
	GetDashboards(ctx context.Context, query *GetDashboardsQuery) ([]*Dashboard, error)
	GetDashboardTags(ctx context.Context, query *GetDashboardTagsQuery) ([]*DashboardTagCloudItem, error)
	GetDashboardUIDByID(ctx context.Context, query *GetDashboardRefByIDQuery) (*DashboardRef, error)
	HasAdminPermissionInDashboardsOrFolders(ctx context.Context, query *folder.HasAdminPermissionInDashboardsOrFoldersQuery) (bool, error)
	HasEditPermissionInFolders(ctx context.Context, query *folder.HasEditPermissionInFoldersQuery) (bool, error)
	ImportDashboard(ctx context.Context, dto *SaveDashboardDTO) (*Dashboard, error)
	MakeUserAdmin(ctx context.Context, orgID int64, userID, dashboardID int64, setViewAndEditPermissions bool) error
	SaveDashboard(ctx context.Context, dto *SaveDashboardDTO, allowUiUpdate bool) (*Dashboard, error)
	SearchDashboards(ctx context.Context, query *FindPersistedDashboardsQuery) (model.HitList, error)
	UpdateDashboardACL(ctx context.Context, uid int64, items []*DashboardACL) error
	DeleteACLByUser(ctx context.Context, userID int64) error
	CountDashboardsInFolder(ctx context.Context, query *CountDashboardsInFolderQuery) (int64, error)
}

// PluginService is a service for operating on plugin dashboards.
type PluginService interface {
	GetDashboardsByPluginID(ctx context.Context, query *GetDashboardsByPluginIDQuery) ([]*Dashboard, error)
}

// DashboardProvisioningService is a service for operating on provisioned dashboards.
//
//go:generate mockery --name DashboardProvisioningService --structname FakeDashboardProvisioning --inpackage --filename dashboard_provisioning_mock.go
type DashboardProvisioningService interface {
	DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *DeleteOrphanedProvisionedDashboardsCommand) error
	DeleteProvisionedDashboard(ctx context.Context, dashboardID int64, orgID int64) error
	GetProvisionedDashboardData(ctx context.Context, name string) ([]*DashboardProvisioning, error)
	GetProvisionedDashboardDataByDashboardID(ctx context.Context, dashboardID int64) (*DashboardProvisioning, error)
	GetProvisionedDashboardDataByDashboardUID(ctx context.Context, orgID int64, dashboardUID string) (*DashboardProvisioning, error)
	SaveFolderForProvisionedDashboards(context.Context, *SaveDashboardDTO) (*Dashboard, error)
	SaveProvisionedDashboard(ctx context.Context, dto *SaveDashboardDTO, provisioning *DashboardProvisioning) (*Dashboard, error)
	UnprovisionDashboard(ctx context.Context, dashboardID int64) error
}

// Store is a dashboard store.
//
//go:generate mockery --name Store --structname FakeDashboardStore --inpackage --filename store_mock.go
type Store interface {
	DeleteDashboard(ctx context.Context, cmd *DeleteDashboardCommand) error
	DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *DeleteOrphanedProvisionedDashboardsCommand) error
	FindDashboards(ctx context.Context, query *FindPersistedDashboardsQuery) ([]DashboardSearchProjection, error)
	GetDashboard(ctx context.Context, query *GetDashboardQuery) (*Dashboard, error)
	GetDashboardACLInfoList(ctx context.Context, query *GetDashboardACLInfoListQuery) ([]*DashboardACLInfoDTO, error)
	GetDashboardUIDByID(ctx context.Context, query *GetDashboardRefByIDQuery) (*DashboardRef, error)
	GetDashboards(ctx context.Context, query *GetDashboardsQuery) ([]*Dashboard, error)
	// GetDashboardsByPluginID retrieves dashboards identified by plugin.
	GetDashboardsByPluginID(ctx context.Context, query *GetDashboardsByPluginIDQuery) ([]*Dashboard, error)
	GetDashboardTags(ctx context.Context, query *GetDashboardTagsQuery) ([]*DashboardTagCloudItem, error)
	GetProvisionedDashboardData(ctx context.Context, name string) ([]*DashboardProvisioning, error)
	GetProvisionedDataByDashboardID(ctx context.Context, dashboardID int64) (*DashboardProvisioning, error)
	GetProvisionedDataByDashboardUID(ctx context.Context, orgID int64, dashboardUID string) (*DashboardProvisioning, error)
	HasAdminPermissionInDashboardsOrFolders(ctx context.Context, query *folder.HasAdminPermissionInDashboardsOrFoldersQuery) (bool, error)
	HasEditPermissionInFolders(ctx context.Context, query *folder.HasEditPermissionInFoldersQuery) (bool, error)
	// SaveAlerts saves dashboard alerts.
	SaveAlerts(ctx context.Context, dashID int64, alerts []*alertmodels.Alert) error
	SaveDashboard(ctx context.Context, cmd SaveDashboardCommand) (*Dashboard, error)
	SaveProvisionedDashboard(ctx context.Context, cmd SaveDashboardCommand, provisioning *DashboardProvisioning) (*Dashboard, error)
	UnprovisionDashboard(ctx context.Context, id int64) error
	UpdateDashboardACL(ctx context.Context, uid int64, items []*DashboardACL) error
	// ValidateDashboardBeforeSave validates a dashboard before save.
	ValidateDashboardBeforeSave(ctx context.Context, dashboard *Dashboard, overwrite bool) (bool, error)
	DeleteACLByUser(context.Context, int64) error

	Count(context.Context, *quota.ScopeParameters) (*quota.Map, error)
	// CountDashboardsInFolder returns the number of dashboards associated with
	// the given parent folder ID.
	CountDashboardsInFolder(ctx context.Context, request *CountDashboardsInFolderRequest) (int64, error)
}
