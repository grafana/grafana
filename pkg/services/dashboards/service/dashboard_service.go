package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"

	"golang.org/x/exp/slices"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	provisionerPermissions = []accesscontrol.Permission{
		{Action: dashboards.ActionFoldersCreate, Scope: dashboards.ScopeFoldersAll},
		{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll},
		{Action: dashboards.ActionDashboardsCreate, Scope: dashboards.ScopeFoldersAll},
		{Action: dashboards.ActionDashboardsWrite, Scope: dashboards.ScopeFoldersAll},
		{Action: datasources.ActionRead, Scope: datasources.ScopeAll},
	}
	// DashboardServiceImpl implements the DashboardService interface
	_ dashboards.DashboardService             = (*DashboardServiceImpl)(nil)
	_ dashboards.DashboardProvisioningService = (*DashboardServiceImpl)(nil)
	_ dashboards.PluginService                = (*DashboardServiceImpl)(nil)

	daysInTrash = 24 * 30 * time.Hour
	tracer      = otel.Tracer("github.com/grafana/grafana/pkg/services/dashboards/service")
)

type DashboardServiceImpl struct {
	cfg                  *setting.Cfg
	log                  log.Logger
	dashboardStore       dashboards.Store
	folderStore          folder.FolderStore
	folderService        folder.Service
	features             featuremgmt.FeatureToggles
	folderPermissions    accesscontrol.FolderPermissionsService
	dashboardPermissions accesscontrol.DashboardPermissionsService
	ac                   accesscontrol.AccessControl
	metrics              *dashboardsMetrics
}

// This is the uber service that implements a three smaller services
func ProvideDashboardServiceImpl(
	cfg *setting.Cfg, dashboardStore dashboards.Store, folderStore folder.FolderStore,
	features featuremgmt.FeatureToggles, folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService, ac accesscontrol.AccessControl,
	folderSvc folder.Service, fStore folder.Store, r prometheus.Registerer,
) (*DashboardServiceImpl, error) {
	dashSvc := &DashboardServiceImpl{
		cfg:                  cfg,
		log:                  log.New("dashboard-service"),
		dashboardStore:       dashboardStore,
		features:             features,
		folderPermissions:    folderPermissionsService,
		dashboardPermissions: dashboardPermissionsService,
		ac:                   ac,
		folderStore:          folderStore,
		folderService:        folderSvc,
		metrics:              newDashboardsMetrics(r),
	}

	ac.RegisterScopeAttributeResolver(dashboards.NewDashboardIDScopeResolver(folderStore, dashSvc, fStore))
	ac.RegisterScopeAttributeResolver(dashboards.NewDashboardUIDScopeResolver(folderStore, dashSvc, fStore))

	if err := folderSvc.RegisterService(dashSvc); err != nil {
		return nil, err
	}

	return dashSvc, nil
}

func (dr *DashboardServiceImpl) GetProvisionedDashboardData(ctx context.Context, name string) ([]*dashboards.DashboardProvisioning, error) {
	return dr.dashboardStore.GetProvisionedDashboardData(ctx, name)
}

func (dr *DashboardServiceImpl) GetProvisionedDashboardDataByDashboardID(ctx context.Context, dashboardID int64) (*dashboards.DashboardProvisioning, error) {
	return dr.dashboardStore.GetProvisionedDataByDashboardID(ctx, dashboardID)
}

func (dr *DashboardServiceImpl) GetProvisionedDashboardDataByDashboardUID(ctx context.Context, orgID int64, dashboardUID string) (*dashboards.DashboardProvisioning, error) {
	return dr.dashboardStore.GetProvisionedDataByDashboardUID(ctx, orgID, dashboardUID)
}

//nolint:gocyclo
func (dr *DashboardServiceImpl) BuildSaveDashboardCommand(ctx context.Context, dto *dashboards.SaveDashboardDTO,
	validateProvisionedDashboard bool) (*dashboards.SaveDashboardCommand, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.BuildSaveDashboardcommand")
	defer span.End()

	dash := dto.Dashboard

	dash.OrgID = dto.OrgID
	dash.Title = strings.TrimSpace(dash.Title)
	dash.Data.Set("title", dash.Title)
	dash.SetUID(strings.TrimSpace(dash.UID))

	if dash.Title == "" {
		return nil, dashboards.ErrDashboardTitleEmpty
	}

	if len(dash.Title) > 5000 {
		return nil, dashboards.ErrDashboardTitleTooLong
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
	// nolint:staticcheck
	if dash.IsFolder && dash.FolderID > 0 {
		return nil, dashboards.ErrDashboardFolderCannotHaveParent
	}

	if dash.IsFolder && strings.EqualFold(dash.Title, dashboards.RootFolderName) {
		return nil, dashboards.ErrDashboardFolderNameExists
	}

	if !util.IsValidShortUID(dash.UID) {
		return nil, dashboards.ErrDashboardInvalidUid
	} else if util.IsShortUIDTooLong(dash.UID) {
		return nil, dashboards.ErrDashboardUidTooLong
	}

	if err := validateDashboardRefreshInterval(dr.cfg.MinRefreshInterval, dash); err != nil {
		return nil, err
	}

	// Validate folder
	if dash.FolderUID != "" {
		folder, err := dr.folderStore.GetFolderByUID(ctx, dash.OrgID, dash.FolderUID)
		if err != nil {
			return nil, err
		}
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		// nolint:staticcheck
		dash.FolderID = folder.ID
	} else if dash.FolderID != 0 { // nolint:staticcheck
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		// nolint:staticcheck
		folder, err := dr.folderStore.GetFolderByID(ctx, dash.OrgID, dash.FolderID)
		if err != nil {
			return nil, err
		}
		dash.FolderUID = folder.UID
	}

	isParentFolderChanged, err := dr.dashboardStore.ValidateDashboardBeforeSave(ctx, dash, dto.Overwrite)
	if err != nil {
		return nil, err
	}

	if isParentFolderChanged {
		// Check that the user is allowed to add a dashboard to the folder
		guardian, err := guardian.NewByDashboard(ctx, dash, dto.OrgID, dto.User)
		if err != nil {
			return nil, err
		}
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		// nolint:staticcheck
		if canSave, err := guardian.CanCreate(dash.FolderID, dash.IsFolder); err != nil || !canSave {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	}

	if validateProvisionedDashboard {
		provisionedData, err := dr.GetProvisionedDashboardDataByDashboardID(ctx, dash.ID)
		if err != nil {
			return nil, err
		}

		if provisionedData != nil {
			return nil, dashboards.ErrDashboardCannotSaveProvisionedDashboard
		}
	}

	guard, err := getGuardianForSavePermissionCheck(ctx, dash, dto.User)
	if err != nil {
		return nil, err
	}

	if dash.ID == 0 {
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		// nolint:staticcheck
		if canCreate, err := guard.CanCreate(dash.FolderID, dash.IsFolder); err != nil || !canCreate {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	} else {
		if canSave, err := guard.CanSave(); err != nil || !canSave {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	}

	var userID int64
	if id, err := identity.UserIdentifier(dto.User.GetID()); err == nil {
		userID = id
	} else {
		dr.log.Debug("User does not belong to a user or service account namespace, using 0 as user ID", "id", dto.User.GetID())
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
	cmd := &dashboards.SaveDashboardCommand{
		Dashboard: dash.Data,
		Message:   dto.Message,
		OrgID:     dto.OrgID,
		Overwrite: dto.Overwrite,
		UserID:    userID,
		FolderID:  dash.FolderID, // nolint:staticcheck
		FolderUID: dash.FolderUID,
		IsFolder:  dash.IsFolder,
		PluginID:  dash.PluginID,
	}

	if !dto.UpdatedAt.IsZero() {
		cmd.UpdatedAt = dto.UpdatedAt
	}

	return cmd, nil
}

func (dr *DashboardServiceImpl) DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *dashboards.DeleteOrphanedProvisionedDashboardsCommand) error {
	return dr.dashboardStore.DeleteOrphanedProvisionedDashboards(ctx, cmd)
}

// getGuardianForSavePermissionCheck returns the guardian to be used for checking permission of dashboard
// It replaces deleted Dashboard.GetDashboardIdForSavePermissionCheck()
func getGuardianForSavePermissionCheck(ctx context.Context, d *dashboards.Dashboard, user identity.Requester) (guardian.DashboardGuardian, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.getGuardianForSavePermissionCheck")
	defer span.End()

	newDashboard := d.ID == 0

	if newDashboard {
		// if it's a new dashboard/folder check the parent folder permissions
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
		// nolint:staticcheck
		guard, err := guardian.New(ctx, d.FolderID, d.OrgID, user)
		if err != nil {
			return nil, err
		}
		return guard, nil
	}
	guard, err := guardian.NewByDashboard(ctx, d, d.OrgID, user)
	if err != nil {
		return nil, err
	}
	return guard, nil
}

func validateDashboardRefreshInterval(minRefreshInterval string, dash *dashboards.Dashboard) error {
	if minRefreshInterval == "" {
		return nil
	}

	refresh := dash.Data.Get("refresh").MustString("")
	if refresh == "" || refresh == "auto" {
		// since no refresh is set it is a valid refresh rate
		return nil
	}

	minRefreshIntervalDur, err := gtime.ParseDuration(minRefreshInterval)
	if err != nil {
		return fmt.Errorf("parsing min refresh interval %q failed: %w", minRefreshInterval, err)
	}
	d, err := gtime.ParseDuration(refresh)
	if err != nil {
		return fmt.Errorf("parsing refresh duration %q failed: %w", refresh, err)
	}

	if d < minRefreshIntervalDur {
		return dashboards.ErrDashboardRefreshIntervalTooShort
	}

	return nil
}

func (dr *DashboardServiceImpl) SaveProvisionedDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO,
	provisioning *dashboards.DashboardProvisioning) (*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.SaveProvisionedDashboard")
	defer span.End()

	if err := validateDashboardRefreshInterval(dr.cfg.MinRefreshInterval, dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for provisioned dashboard to minimum refresh interval", "dashboardUid",
			dto.Dashboard.UID, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval", dr.cfg.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", dr.cfg.MinRefreshInterval)
	}

	dto.User = accesscontrol.BackgroundUser("dashboard_provisioning", dto.OrgID, org.RoleAdmin, provisionerPermissions)

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, false)
	if err != nil {
		return nil, err
	}

	// dashboard
	dash, err := dr.dashboardStore.SaveProvisionedDashboard(ctx, *cmd, provisioning)
	if err != nil {
		return nil, err
	}

	if dto.Dashboard.ID == 0 {
		dr.setDefaultPermissions(ctx, dto, dash, true)
	}

	return dash, nil
}

func (dr *DashboardServiceImpl) SaveFolderForProvisionedDashboards(ctx context.Context, dto *folder.CreateFolderCommand) (*folder.Folder, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.SaveFolderForProvisionedDashboards")
	defer span.End()

	dto.SignedInUser = accesscontrol.BackgroundUser("dashboard_provisioning", dto.OrgID, org.RoleAdmin, provisionerPermissions)
	f, err := dr.folderService.Create(ctx, dto)
	if err != nil {
		dr.log.Error("failed to create folder for provisioned dashboards", "folder", dto.Title, "org", dto.OrgID, "err", err)
		return nil, err
	}

	dr.setDefaultFolderPermissions(ctx, dto, f, true)
	return f, nil
}

func (dr *DashboardServiceImpl) SaveDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO,
	allowUiUpdate bool) (*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.SaveDashboard")
	defer span.End()

	if err := validateDashboardRefreshInterval(dr.cfg.MinRefreshInterval, dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for imported dashboard to minimum refresh interval",
			"dashboardUid", dto.Dashboard.UID, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval",
			dr.cfg.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", dr.cfg.MinRefreshInterval)
	}

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, !allowUiUpdate)
	if err != nil {
		return nil, err
	}

	dash, err := dr.dashboardStore.SaveDashboard(ctx, *cmd)
	if err != nil {
		return nil, fmt.Errorf("saving dashboard failed: %w", err)
	}

	// new dashboard created
	if dto.Dashboard.ID == 0 {
		dr.setDefaultPermissions(ctx, dto, dash, false)
	}

	return dash, nil
}
func (dr *DashboardServiceImpl) GetSoftDeletedDashboard(ctx context.Context, orgID int64, uid string) (*dashboards.Dashboard, error) {
	return dr.dashboardStore.GetSoftDeletedDashboard(ctx, orgID, uid)
}

func (dr *DashboardServiceImpl) RestoreDashboard(ctx context.Context, dashboard *dashboards.Dashboard, user identity.Requester, optionalFolderUID string) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.RestoreDashboard")
	defer span.End()

	if !dr.features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore) {
		return fmt.Errorf("feature flag %s is not enabled", featuremgmt.FlagDashboardRestore)
	}

	// if the optionalFolder is provided we need to check if the folder exists and user has access to it
	if optionalFolderUID != "" {
		restoringFolder, err := dr.folderService.Get(ctx, &folder.GetFolderQuery{
			UID:          &optionalFolderUID,
			OrgID:        dashboard.OrgID,
			SignedInUser: user,
		})
		if err != nil {
			if errors.Is(err, dashboards.ErrFolderNotFound) {
				return dashboards.ErrFolderRestoreNotFound
			}
			return folder.ErrInternal.Errorf("failed to fetch parent folder from store: %w", err)
		}

		return dr.dashboardStore.RestoreDashboard(ctx, dashboard.OrgID, dashboard.UID, restoringFolder)
	}

	// if the optionalFolder is not provided we need to restore the dashboard to the original folder
	// we check for permissions and the folder existence before restoring
	restoringFolder, err := dr.folderService.Get(ctx, &folder.GetFolderQuery{
		UID:          &dashboard.FolderUID,
		OrgID:        dashboard.OrgID,
		SignedInUser: user,
	})
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			return dashboards.ErrFolderRestoreNotFound
		}
		return folder.ErrInternal.Errorf("failed to fetch parent folder from store: %w", err)
	}

	return dr.dashboardStore.RestoreDashboard(ctx, dashboard.OrgID, dashboard.UID, restoringFolder)
}

func (dr *DashboardServiceImpl) SoftDeleteDashboard(ctx context.Context, orgID int64, dashboardUID string) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.SoftDeleteDashboard")
	defer span.End()

	if !dr.features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore) {
		return fmt.Errorf("feature flag %s is not enabled", featuremgmt.FlagDashboardRestore)
	}

	provisionedData, _ := dr.GetProvisionedDashboardDataByDashboardUID(ctx, orgID, dashboardUID)
	if provisionedData != nil && provisionedData.ID != 0 {
		return dashboards.ErrDashboardCannotDeleteProvisionedDashboard
	}

	return dr.dashboardStore.SoftDeleteDashboard(ctx, orgID, dashboardUID)
}

// DeleteDashboard removes dashboard from the DB. Errors out if the dashboard was provisioned. Should be used for
// operations by the user where we want to make sure user does not delete provisioned dashboard.
func (dr *DashboardServiceImpl) DeleteDashboard(ctx context.Context, dashboardId int64, orgId int64) error {
	return dr.deleteDashboard(ctx, dashboardId, orgId, true)
}

func (dr *DashboardServiceImpl) GetDashboardByPublicUid(ctx context.Context, dashboardPublicUid string) (*dashboards.Dashboard, error) {
	return nil, nil
}

// DeleteProvisionedDashboard removes dashboard from the DB even if it is provisioned.
func (dr *DashboardServiceImpl) DeleteProvisionedDashboard(ctx context.Context, dashboardId int64, orgId int64) error {
	return dr.deleteDashboard(ctx, dashboardId, orgId, false)
}

func (dr *DashboardServiceImpl) deleteDashboard(ctx context.Context, dashboardId int64, orgId int64, validateProvisionedDashboard bool) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.deleteDashboard")
	defer span.End()

	if validateProvisionedDashboard {
		provisionedData, err := dr.GetProvisionedDashboardDataByDashboardID(ctx, dashboardId)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to check if dashboard is provisioned", err)
		}

		if provisionedData != nil {
			return dashboards.ErrDashboardCannotDeleteProvisionedDashboard
		}
	}
	cmd := &dashboards.DeleteDashboardCommand{OrgID: orgId, ID: dashboardId}
	return dr.dashboardStore.DeleteDashboard(ctx, cmd)
}

func (dr *DashboardServiceImpl) ImportDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO) (
	*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.ImportDashboard")
	defer span.End()

	if err := validateDashboardRefreshInterval(dr.cfg.MinRefreshInterval, dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for imported dashboard to minimum refresh interval",
			"dashboardUid", dto.Dashboard.UID, "dashboardTitle", dto.Dashboard.Title,
			"minRefreshInterval", dr.cfg.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", dr.cfg.MinRefreshInterval)
	}

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, true)
	if err != nil {
		return nil, err
	}

	dash, err := dr.dashboardStore.SaveDashboard(ctx, *cmd)
	if err != nil {
		return nil, err
	}

	dr.setDefaultPermissions(ctx, dto, dash, false)

	return dash, nil
}

// UnprovisionDashboard removes info about dashboard being provisioned. Used after provisioning configs are changed
// and provisioned dashboards are left behind but not deleted.
func (dr *DashboardServiceImpl) UnprovisionDashboard(ctx context.Context, dashboardId int64) error {
	return dr.dashboardStore.UnprovisionDashboard(ctx, dashboardId)
}

func (dr *DashboardServiceImpl) GetDashboardsByPluginID(ctx context.Context, query *dashboards.GetDashboardsByPluginIDQuery) ([]*dashboards.Dashboard, error) {
	return dr.dashboardStore.GetDashboardsByPluginID(ctx, query)
}

func (dr *DashboardServiceImpl) setDefaultPermissions(ctx context.Context, dto *dashboards.SaveDashboardDTO, dash *dashboards.Dashboard, provisioned bool) {
	ctx, span := tracer.Start(ctx, "dashboards.service.setDefaultPermissions")
	defer span.End()

	resource := "dashboard"
	if dash.IsFolder {
		resource = "folder"
	}

	if !dr.cfg.RBAC.PermissionsOnCreation(resource) {
		return
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
	// nolint:staticcheck
	inFolder := dash.FolderID > 0
	var permissions []accesscontrol.SetResourcePermissionCommand

	if !provisioned && dto.User.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		userID, err := dto.User.GetInternalID()
		if err != nil {
			dr.log.Error("Could not make user admin", "dashboard", dash.Title, "id", dto.User.GetID(), "error", err)
		} else {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: userID, Permission: dashboardaccess.PERMISSION_ADMIN.String(),
			})
		}
	}

	if !inFolder {
		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
			{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
		}...)
	}

	svc := dr.dashboardPermissions
	if dash.IsFolder {
		svc = dr.folderPermissions
	}

	if _, err := svc.SetPermissions(ctx, dto.OrgID, dash.UID, permissions...); err != nil {
		dr.log.Error("Could not set default permissions", "dashboard", dash.Title, "error", err)
	}
}

func (dr *DashboardServiceImpl) setDefaultFolderPermissions(ctx context.Context, cmd *folder.CreateFolderCommand, f *folder.Folder, provisioned bool) {
	ctx, span := tracer.Start(ctx, "dashboards.service.setDefaultFolderPermissions")
	defer span.End()

	if !dr.cfg.RBAC.PermissionsOnCreation("folder") {
		return
	}

	inFolder := f.ParentUID != ""
	var permissions []accesscontrol.SetResourcePermissionCommand

	if !provisioned && cmd.SignedInUser.IsIdentityType(claims.TypeUser) {
		userID, err := cmd.SignedInUser.GetInternalID()
		if err != nil {
			dr.log.Error("Could not make user admin", "folder", cmd.Title, "id", cmd.SignedInUser.GetID())
		} else {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: userID, Permission: dashboardaccess.PERMISSION_ADMIN.String(),
			})
		}
	}

	if !inFolder {
		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
			{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
		}...)
	}

	if _, err := dr.folderPermissions.SetPermissions(ctx, cmd.OrgID, f.UID, permissions...); err != nil {
		dr.log.Error("Could not set default folder permissions", "folder", f.Title, "error", err)
	}
}

func (dr *DashboardServiceImpl) GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	return dr.dashboardStore.GetDashboard(ctx, query)
}

func (dr *DashboardServiceImpl) GetDashboardUIDByID(ctx context.Context, query *dashboards.GetDashboardRefByIDQuery) (*dashboards.DashboardRef, error) {
	return dr.dashboardStore.GetDashboardUIDByID(ctx, query)
}

func (dr *DashboardServiceImpl) GetDashboards(ctx context.Context, query *dashboards.GetDashboardsQuery) ([]*dashboards.Dashboard, error) {
	return dr.dashboardStore.GetDashboards(ctx, query)
}

func (dr *DashboardServiceImpl) GetDashboardsSharedWithUser(ctx context.Context, user identity.Requester) ([]*dashboards.Dashboard, error) {
	return dr.getDashboardsSharedWithUser(ctx, user)
}

func (dr *DashboardServiceImpl) getDashboardsSharedWithUser(ctx context.Context, user identity.Requester) ([]*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.getDashboardsSharedWithUser")
	defer span.End()

	permissions := user.GetPermissions()
	dashboardPermissions := permissions[dashboards.ActionDashboardsRead]
	sharedDashboards := make([]*dashboards.Dashboard, 0)
	dashboardUids := make([]string, 0)
	for _, p := range dashboardPermissions {
		if dashboardUid, found := strings.CutPrefix(p, dashboards.ScopeDashboardsPrefix); found {
			if !slices.Contains(dashboardUids, dashboardUid) {
				dashboardUids = append(dashboardUids, dashboardUid)
			}
		}
	}

	if len(dashboardUids) == 0 {
		return sharedDashboards, nil
	}

	dashboardsQuery := &dashboards.GetDashboardsQuery{
		DashboardUIDs: dashboardUids,
		OrgID:         user.GetOrgID(),
	}
	sharedDashboards, err := dr.dashboardStore.GetDashboards(ctx, dashboardsQuery)
	if err != nil {
		return nil, err
	}
	return dr.filterUserSharedDashboards(ctx, user, sharedDashboards)
}

// filterUserSharedDashboards filter dashboards directly assigned to user, but not located in folders with view permissions
func (dr *DashboardServiceImpl) filterUserSharedDashboards(ctx context.Context, user identity.Requester, userDashboards []*dashboards.Dashboard) ([]*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.filterUserSharedDashboards")
	defer span.End()

	filteredDashboards := make([]*dashboards.Dashboard, 0)

	folderUIDs := make([]string, 0)
	for _, dashboard := range userDashboards {
		folderUIDs = append(folderUIDs, dashboard.FolderUID)
	}

	// GetFolders return only folders available to user. So we can use is to check access.
	userDashFolders, err := dr.folderService.GetFolders(ctx, folder.GetFoldersQuery{
		UIDs:         folderUIDs,
		OrgID:        user.GetOrgID(),
		OrderByTitle: true,
		SignedInUser: user,
	})
	if err != nil {
		return nil, folder.ErrInternal.Errorf("failed to fetch parent folders from store: %w", err)
	}

	dashFoldersMap := make(map[string]*folder.Folder, 0)
	for _, f := range userDashFolders {
		dashFoldersMap[f.UID] = f
	}

	for _, dashboard := range userDashboards {
		// Filter out dashboards if user has access to parent folder
		if dashboard.FolderUID == "" {
			continue
		}

		_, hasAccess := dashFoldersMap[dashboard.FolderUID]
		if !hasAccess {
			filteredDashboards = append(filteredDashboards, dashboard)
		}
	}
	return filteredDashboards, nil
}

func (dr *DashboardServiceImpl) getUserSharedDashboardUIDs(ctx context.Context, user identity.Requester) ([]string, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.getUserSharedDashboardsUIDs")
	defer span.End()

	userDashboards, err := dr.getDashboardsSharedWithUser(ctx, user)
	if err != nil {
		return nil, err
	}
	userDashboardUIDs := make([]string, 0)
	for _, dashboard := range userDashboards {
		userDashboardUIDs = append(userDashboardUIDs, dashboard.UID)
	}
	return userDashboardUIDs, nil
}

func (dr *DashboardServiceImpl) FindDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.FindDashboards")
	defer span.End()

	if dr.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders) && len(query.FolderUIDs) > 0 && slices.Contains(query.FolderUIDs, folder.SharedWithMeFolderUID) {
		start := time.Now()
		userDashboardUIDs, err := dr.getUserSharedDashboardUIDs(ctx, query.SignedInUser)
		if err != nil {
			dr.metrics.sharedWithMeFetchDashboardsRequestsDuration.WithLabelValues("failure").Observe(time.Since(start).Seconds())
			return nil, err
		}
		if len(userDashboardUIDs) == 0 {
			return []dashboards.DashboardSearchProjection{}, nil
		}
		query.DashboardUIDs = userDashboardUIDs
		query.FolderUIDs = []string{}

		defer func(t time.Time) {
			dr.metrics.sharedWithMeFetchDashboardsRequestsDuration.WithLabelValues("success").Observe(time.Since(start).Seconds())
		}(time.Now())
	}
	return dr.dashboardStore.FindDashboards(ctx, query)
}

func (dr *DashboardServiceImpl) SearchDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) (model.HitList, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.SearchDashboards")
	defer span.End()

	var res []dashboards.DashboardSearchProjection
	var err error
	if dr.features.IsEnabled(ctx, featuremgmt.FlagZanzana) {
		res, err = dr.FindDashboardsZanzana(ctx, query)
	} else {
		res, err = dr.FindDashboards(ctx, query)
	}
	if err != nil {
		return nil, err
	}

	hits := makeQueryResult(query, res)

	return hits, nil
}

func (dr *DashboardServiceImpl) GetAllDashboards(ctx context.Context) ([]*dashboards.Dashboard, error) {
	return dr.dashboardStore.GetAllDashboards(ctx)
}

func getHitType(item dashboards.DashboardSearchProjection) model.HitType {
	var hitType model.HitType
	if item.IsFolder {
		hitType = model.DashHitFolder
	} else {
		hitType = model.DashHitDB
	}

	return hitType
}

func makeQueryResult(query *dashboards.FindPersistedDashboardsQuery, res []dashboards.DashboardSearchProjection) model.HitList {
	hitList := make([]*model.Hit, 0)
	hits := make(map[int64]*model.Hit)

	for _, item := range res {
		hit, exists := hits[item.ID]
		if !exists {
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
			hit = &model.Hit{
				ID:          item.ID,
				UID:         item.UID,
				Title:       item.Title,
				URI:         "db/" + item.Slug,
				URL:         dashboards.GetDashboardFolderURL(item.IsFolder, item.UID, item.Slug),
				Type:        getHitType(item),
				FolderID:    item.FolderID, // nolint:staticcheck
				FolderUID:   item.FolderUID,
				FolderTitle: item.FolderTitle,
				Tags:        []string{},
			}

			// nolint:staticcheck
			if item.FolderID > 0 {
				hit.FolderURL = dashboards.GetFolderURL(item.FolderUID, item.FolderSlug)
			}

			if query.Sort.MetaName != "" {
				hit.SortMeta = item.SortMeta
				hit.SortMetaName = query.Sort.MetaName
			}

			hitList = append(hitList, hit)
			hits[item.ID] = hit
		}
		if len(item.Term) > 0 {
			hit.Tags = append(hit.Tags, item.Term)
		}
		if item.Deleted != nil {
			deletedDate := (*item.Deleted).Add(daysInTrash)
			hit.IsDeleted = true
			hit.PermanentlyDeleteDate = &deletedDate
		}
	}
	return hitList
}

func (dr *DashboardServiceImpl) GetDashboardTags(ctx context.Context, query *dashboards.GetDashboardTagsQuery) ([]*dashboards.DashboardTagCloudItem, error) {
	return dr.dashboardStore.GetDashboardTags(ctx, query)
}

func (dr DashboardServiceImpl) CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, u identity.Requester) (int64, error) {
	return dr.dashboardStore.CountDashboardsInFolders(ctx, &dashboards.CountDashboardsInFolderRequest{FolderUIDs: folderUIDs, OrgID: orgID})
}

func (dr *DashboardServiceImpl) DeleteInFolders(ctx context.Context, orgID int64, folderUIDs []string, u identity.Requester) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.DeleteInFolders")
	defer span.End()

	if dr.features.IsEnabledGlobally(featuremgmt.FlagDashboardRestore) {
		return dr.dashboardStore.SoftDeleteDashboardsInFolders(ctx, orgID, folderUIDs)
	}

	return dr.dashboardStore.DeleteDashboardsInFolders(ctx, &dashboards.DeleteDashboardsInFolderRequest{FolderUIDs: folderUIDs, OrgID: orgID})
}

func (dr *DashboardServiceImpl) Kind() string { return entity.StandardKindDashboard }

func (dr *DashboardServiceImpl) CleanUpDeletedDashboards(ctx context.Context) (int64, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.CleanUpDeletedDashboards")
	defer span.End()

	var deletedDashboardsCount int64
	deletedDashboards, err := dr.dashboardStore.GetSoftDeletedExpiredDashboards(ctx, daysInTrash)
	if err != nil {
		return 0, err
	}
	for _, dashboard := range deletedDashboards {
		err = dr.DeleteDashboard(ctx, dashboard.ID, dashboard.OrgID)
		if err != nil {
			dr.log.Warn("Failed to cleanup deleted dashboard", "dashboardUid", dashboard.UID, "error", err)
			break
		}
		deletedDashboardsCount++
	}

	return deletedDashboardsCount, nil
}
