package dashboards

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/search/model"
)

// DashboardService is a service for operating on dashboards.
//
//go:generate mockery --name DashboardService --structname FakeDashboardService --inpackage --filename dashboard_service_mock.go
type DashboardService interface {
	BuildSaveDashboardCommand(ctx context.Context, dto *SaveDashboardDTO, validateProvisionedDashboard bool) (*SaveDashboardCommand, error)
	DeleteDashboard(ctx context.Context, dashboardId int64, dashboardUID string, orgId int64) error
	DeleteAllDashboards(ctx context.Context, orgID int64) error
	FindDashboards(ctx context.Context, query *FindPersistedDashboardsQuery) ([]DashboardSearchProjection, error)
	// GetDashboard fetches a dashboard.
	// To fetch a dashboard under root by title should set the folder UID to point to an empty string
	// eg. util.Pointer("")
	GetDashboard(ctx context.Context, query *GetDashboardQuery) (*Dashboard, error)
	GetDashboards(ctx context.Context, query *GetDashboardsQuery) ([]*Dashboard, error)
	GetDashboardTags(ctx context.Context, query *GetDashboardTagsQuery) ([]*DashboardTagCloudItem, error)
	GetDashboardUIDByID(ctx context.Context, query *GetDashboardRefByIDQuery) (*DashboardRef, error)
	ImportDashboard(ctx context.Context, dto *SaveDashboardDTO) (*Dashboard, error)
	SaveDashboard(ctx context.Context, dto *SaveDashboardDTO, allowUiUpdate bool) (*Dashboard, error)
	SearchDashboards(ctx context.Context, query *FindPersistedDashboardsQuery) (model.HitList, error)
	CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) (int64, error)
	GetDashboardsSharedWithUser(ctx context.Context, user identity.Requester) ([]*Dashboard, error)
	GetAllDashboards(ctx context.Context) ([]*Dashboard, error)
	GetAllDashboardsByOrgId(ctx context.Context, orgID int64) ([]*Dashboard, error)
	SoftDeleteDashboard(ctx context.Context, orgID int64, dashboardUid string) error
	RestoreDashboard(ctx context.Context, dashboard *Dashboard, user identity.Requester, optionalFolderUID string) error
	CleanUpDeletedDashboards(ctx context.Context) (int64, error)
	GetSoftDeletedDashboard(ctx context.Context, orgID int64, uid string) (*Dashboard, error)
	CountDashboardsInOrg(ctx context.Context, orgID int64) (int64, error)
}

type PermissionsRegistrationService interface {
	RegisterDashboardPermissions(service accesscontrol.DashboardPermissionsService)
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
	SaveFolderForProvisionedDashboards(context.Context, *folder.CreateFolderCommand) (*folder.Folder, error)
	SaveProvisionedDashboard(ctx context.Context, dto *SaveDashboardDTO, provisioning *DashboardProvisioning) (*Dashboard, error)
	UnprovisionDashboard(ctx context.Context, dashboardID int64) error
}

// Store is a dashboard store.
//
//go:generate mockery --name Store --structname FakeDashboardStore --inpackage --filename store_mock.go
type Store interface {
	DeleteDashboard(ctx context.Context, cmd *DeleteDashboardCommand) error
	CleanupAfterDelete(ctx context.Context, cmd *DeleteDashboardCommand) error
	DeleteAllDashboards(ctx context.Context, orgID int64) error
	DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *DeleteOrphanedProvisionedDashboardsCommand) error
	FindDashboards(ctx context.Context, query *FindPersistedDashboardsQuery) ([]DashboardSearchProjection, error)
	GetDashboard(ctx context.Context, query *GetDashboardQuery) (*Dashboard, error)
	GetDashboardUIDByID(ctx context.Context, query *GetDashboardRefByIDQuery) (*DashboardRef, error)
	GetDashboards(ctx context.Context, query *GetDashboardsQuery) ([]*Dashboard, error)
	// GetDashboardsByPluginID retrieves dashboards identified by plugin.
	GetDashboardsByPluginID(ctx context.Context, query *GetDashboardsByPluginIDQuery) ([]*Dashboard, error)
	GetDashboardTags(ctx context.Context, query *GetDashboardTagsQuery) ([]*DashboardTagCloudItem, error)
	GetProvisionedDashboardData(ctx context.Context, name string) ([]*DashboardProvisioning, error)
	GetProvisionedDataByDashboardID(ctx context.Context, dashboardID int64) (*DashboardProvisioning, error)
	GetProvisionedDataByDashboardUID(ctx context.Context, orgID int64, dashboardUID string) (*DashboardProvisioning, error)
	GetProvisionedDashboardsByName(ctx context.Context, name string) ([]*Dashboard, error)
	GetOrphanedProvisionedDashboards(ctx context.Context, notIn []string) ([]*Dashboard, error)
	SaveDashboard(ctx context.Context, cmd SaveDashboardCommand) (*Dashboard, error)
	SaveProvisionedDashboard(ctx context.Context, dash *Dashboard, provisioning *DashboardProvisioning) error
	UnprovisionDashboard(ctx context.Context, id int64) error
	// ValidateDashboardBeforeSave validates a dashboard before save.
	ValidateDashboardBeforeSave(ctx context.Context, dashboard *Dashboard, overwrite bool) (bool, error)

	Count(context.Context, *quota.ScopeParameters) (*quota.Map, error)
	CountInOrg(ctx context.Context, orgID int64) (int64, error)
	// CountDashboardsInFolder returns the number of dashboards associated with
	// the given parent folder ID.
	CountDashboardsInFolders(ctx context.Context, request *CountDashboardsInFolderRequest) (int64, error)
	DeleteDashboardsInFolders(ctx context.Context, request *DeleteDashboardsInFolderRequest) error

	GetAllDashboards(ctx context.Context) ([]*Dashboard, error)
	GetAllDashboardsByOrgId(ctx context.Context, orgID int64) ([]*Dashboard, error)
	GetSoftDeletedExpiredDashboards(ctx context.Context, duration time.Duration) ([]*Dashboard, error)
	SoftDeleteDashboard(ctx context.Context, orgID int64, dashboardUid string) error
	SoftDeleteDashboardsInFolders(ctx context.Context, orgID int64, folderUids []string) error
	RestoreDashboard(ctx context.Context, orgID int64, dashboardUid string, folder *folder.Folder) error
	GetSoftDeletedDashboard(ctx context.Context, orgID int64, uid string) (*Dashboard, error)
}
