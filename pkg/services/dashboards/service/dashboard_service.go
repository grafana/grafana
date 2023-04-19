package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	provisionerPermissions = []accesscontrol.Permission{
		{Action: dashboards.ActionFoldersCreate},
		{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll},
		{Action: dashboards.ActionDashboardsCreate, Scope: dashboards.ScopeFoldersAll},
		{Action: dashboards.ActionDashboardsWrite, Scope: dashboards.ScopeFoldersAll},
	}
	// DashboardServiceImpl implements the DashboardService interface
	_ dashboards.DashboardService             = (*DashboardServiceImpl)(nil)
	_ dashboards.DashboardProvisioningService = (*DashboardServiceImpl)(nil)
	_ dashboards.PluginService                = (*DashboardServiceImpl)(nil)
)

type DashboardServiceImpl struct {
	cfg                  *setting.Cfg
	log                  log.Logger
	dashboardStore       dashboards.Store
	folderStore          folder.FolderStore
	folderService        folder.Service
	dashAlertExtractor   alerting.DashAlertExtractor
	features             featuremgmt.FeatureToggles
	folderPermissions    accesscontrol.FolderPermissionsService
	dashboardPermissions accesscontrol.DashboardPermissionsService
	ac                   accesscontrol.AccessControl
}

// This is the uber service that implements a three smaller services
func ProvideDashboardServiceImpl(
	cfg *setting.Cfg, dashboardStore dashboards.Store, folderStore folder.FolderStore, dashAlertExtractor alerting.DashAlertExtractor,
	features featuremgmt.FeatureToggles, folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService, ac accesscontrol.AccessControl,
	folderSvc folder.Service,
) (*DashboardServiceImpl, error) {
	dashSvc := &DashboardServiceImpl{
		cfg:                  cfg,
		log:                  log.New("dashboard-service"),
		dashboardStore:       dashboardStore,
		dashAlertExtractor:   dashAlertExtractor,
		features:             features,
		folderPermissions:    folderPermissionsService,
		dashboardPermissions: dashboardPermissionsService,
		ac:                   ac,
		folderStore:          folderStore,
		folderService:        folderSvc,
	}

	ac.RegisterScopeAttributeResolver(dashboards.NewDashboardIDScopeResolver(folderStore, dashSvc, folderSvc))
	ac.RegisterScopeAttributeResolver(dashboards.NewDashboardUIDScopeResolver(folderStore, dashSvc, folderSvc))

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

func (dr *DashboardServiceImpl) BuildSaveDashboardCommand(ctx context.Context, dto *dashboards.SaveDashboardDTO, shouldValidateAlerts bool,
	validateProvisionedDashboard bool) (*dashboards.SaveDashboardCommand, error) {
	dash := dto.Dashboard

	dash.OrgID = dto.OrgID
	dash.Title = strings.TrimSpace(dash.Title)
	dash.Data.Set("title", dash.Title)
	dash.SetUID(strings.TrimSpace(dash.UID))

	if dash.Title == "" {
		return nil, dashboards.ErrDashboardTitleEmpty
	}

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

	if err := validateDashboardRefreshInterval(dash); err != nil {
		return nil, err
	}

	if shouldValidateAlerts {
		dashAlertInfo := alerting.DashAlertInfo{Dash: dash, User: dto.User, OrgID: dash.OrgID}
		if err := dr.dashAlertExtractor.ValidateAlerts(ctx, dashAlertInfo); err != nil {
			return nil, err
		}
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
		fmt.Printf("getGuardianForSavePermissionCheck error: %v", err)
		return nil, err
	}
	fmt.Printf("getGuardianForSavePermissionCheck: %v", guard)

	if dash.ID == 0 {
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

	cmd := &dashboards.SaveDashboardCommand{
		Dashboard: dash.Data,
		Message:   dto.Message,
		OrgID:     dto.OrgID,
		Overwrite: dto.Overwrite,
		UserID:    dto.User.UserID,
		FolderID:  dash.FolderID,
		IsFolder:  dash.IsFolder,
		PluginID:  dash.PluginID,
	}

	if !dto.UpdatedAt.IsZero() {
		cmd.UpdatedAt = dto.UpdatedAt
	}

	return cmd, nil
}

func (dr *DashboardServiceImpl) UpdateDashboardACL(ctx context.Context, uid int64, items []*dashboards.DashboardACL) error {
	return dr.dashboardStore.UpdateDashboardACL(ctx, uid, items)
}

func (dr *DashboardServiceImpl) DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *dashboards.DeleteOrphanedProvisionedDashboardsCommand) error {
	return dr.dashboardStore.DeleteOrphanedProvisionedDashboards(ctx, cmd)
}

// getGuardianForSavePermissionCheck returns the guardian to be used for checking permission of dashboard
// It replaces deleted Dashboard.GetDashboardIdForSavePermissionCheck()
func getGuardianForSavePermissionCheck(ctx context.Context, d *dashboards.Dashboard, user *user.SignedInUser) (guardian.DashboardGuardian, error) {
	newDashboard := d.ID == 0

	if newDashboard {
		// if it's a new dashboard/folder check the parent folder permissions
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

func validateDashboardRefreshInterval(dash *dashboards.Dashboard) error {
	if setting.MinRefreshInterval == "" {
		return nil
	}

	refresh := dash.Data.Get("refresh").MustString("")
	if refresh == "" {
		// since no refresh is set it is a valid refresh rate
		return nil
	}

	minRefreshInterval, err := gtime.ParseDuration(setting.MinRefreshInterval)
	if err != nil {
		return fmt.Errorf("parsing min refresh interval %q failed: %w", setting.MinRefreshInterval, err)
	}
	d, err := gtime.ParseDuration(refresh)
	if err != nil {
		return fmt.Errorf("parsing refresh duration %q failed: %w", refresh, err)
	}

	if d < minRefreshInterval {
		return dashboards.ErrDashboardRefreshIntervalTooShort
	}

	return nil
}

func (dr *DashboardServiceImpl) SaveProvisionedDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO,
	provisioning *dashboards.DashboardProvisioning) (*dashboards.Dashboard, error) {
	if err := validateDashboardRefreshInterval(dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for provisioned dashboard to minimum refresh interval", "dashboardUid",
			dto.Dashboard.UID, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval", setting.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", setting.MinRefreshInterval)
	}

	dto.User = accesscontrol.BackgroundUser("dashboard_provisioning", dto.OrgID, org.RoleAdmin, provisionerPermissions)

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, setting.IsLegacyAlertingEnabled(), false)
	if err != nil {
		return nil, err
	}

	// dashboard
	dash, err := dr.dashboardStore.SaveProvisionedDashboard(ctx, *cmd, provisioning)
	if err != nil {
		return nil, err
	}

	// alerts
	dashAlertInfo := alerting.DashAlertInfo{
		User:  dto.User,
		Dash:  dash,
		OrgID: dto.OrgID,
	}

	// extract/save legacy alerts only if legacy alerting is enabled
	if setting.IsLegacyAlertingEnabled() {
		alerts, err := dr.dashAlertExtractor.GetAlerts(ctx, dashAlertInfo)
		if err != nil {
			return nil, err
		}

		err = dr.dashboardStore.SaveAlerts(ctx, dash.ID, alerts)
		if err != nil {
			return nil, err
		}
	}

	if dto.Dashboard.ID == 0 {
		if err := dr.setDefaultPermissions(ctx, dto, dash, true); err != nil {
			dr.log.Error("Could not make user admin", "dashboard", dash.Title, "user", dto.User.UserID, "error", err)
		}
	}

	return dash, nil
}

func (dr *DashboardServiceImpl) SaveFolderForProvisionedDashboards(ctx context.Context, dto *dashboards.SaveDashboardDTO) (*dashboards.Dashboard, error) {
	dto.User = accesscontrol.BackgroundUser("dashboard_provisioning", dto.OrgID, org.RoleAdmin, provisionerPermissions)
	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, false, false)
	if err != nil {
		return nil, err
	}

	dash, err := dr.dashboardStore.SaveDashboard(ctx, *cmd)
	if err != nil {
		return nil, err
	}

	dashAlertInfo := alerting.DashAlertInfo{
		User:  dto.User,
		Dash:  dash,
		OrgID: dto.OrgID,
	}

	// extract/save legacy alerts only if legacy alerting is enabled
	if setting.IsLegacyAlertingEnabled() {
		alerts, err := dr.dashAlertExtractor.GetAlerts(ctx, dashAlertInfo)
		if err != nil {
			return nil, err
		}

		err = dr.dashboardStore.SaveAlerts(ctx, dash.ID, alerts)
		if err != nil {
			return nil, err
		}
	}

	if dto.Dashboard.ID == 0 {
		if err := dr.setDefaultPermissions(ctx, dto, dash, true); err != nil {
			dr.log.Error("Could not make user admin", "dashboard", dash.Title, "user", dto.User.UserID, "error", err)
		}
	}

	return dash, nil
}

func (dr *DashboardServiceImpl) SaveDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO,
	allowUiUpdate bool) (*dashboards.Dashboard, error) {
	if err := validateDashboardRefreshInterval(dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for imported dashboard to minimum refresh interval",
			"dashboardUid", dto.Dashboard.UID, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval",
			setting.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", setting.MinRefreshInterval)
	}

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, setting.IsLegacyAlertingEnabled(), !allowUiUpdate)
	if err != nil {
		fmt.Printf("BuildSaveDashboardCommand failed: %v", err)
		return nil, err
	}

	dash, err := dr.dashboardStore.SaveDashboard(ctx, *cmd)
	if err != nil {
		return nil, fmt.Errorf("saving dashboard failed: %w", err)
	}

	dashAlertInfo := alerting.DashAlertInfo{
		User:  dto.User,
		Dash:  dash,
		OrgID: dto.OrgID,
	}

	// extract/save legacy alerts only if legacy alerting is enabled
	if setting.IsLegacyAlertingEnabled() {
		alerts, err := dr.dashAlertExtractor.GetAlerts(ctx, dashAlertInfo)
		if err != nil {
			return nil, err
		}

		err = dr.dashboardStore.SaveAlerts(ctx, dash.ID, alerts)
		if err != nil {
			return nil, err
		}
	}

	// new dashboard created
	if dto.Dashboard.ID == 0 {
		if err := dr.setDefaultPermissions(ctx, dto, dash, false); err != nil {
			dr.log.Error("Could not make user admin", "dashboard", dash.Title, "user", dto.User.UserID, "error", err)
		}
	}

	return dash, nil
}

// DeleteDashboard removes dashboard from the DB. Errors out if the dashboard was provisioned. Should be used for
// operations by the user where we want to make sure user does not delete provisioned dashboard.
func (dr *DashboardServiceImpl) DeleteDashboard(ctx context.Context, dashboardId int64, orgId int64) error {
	return dr.deleteDashboard(ctx, dashboardId, orgId, true)
}

func (dr *DashboardServiceImpl) GetDashboardByPublicUid(ctx context.Context, dashboardPublicUid string) (*dashboards.Dashboard, error) {
	return nil, nil
}

func (dr *DashboardServiceImpl) MakeUserAdmin(ctx context.Context, orgID int64, userID int64, dashboardID int64, setViewAndEditPermissions bool) error {
	rtEditor := org.RoleEditor
	rtViewer := org.RoleViewer

	items := []*dashboards.DashboardACL{
		{
			OrgID:       orgID,
			DashboardID: dashboardID,
			UserID:      userID,
			Permission:  dashboards.PERMISSION_ADMIN,
			Created:     time.Now(),
			Updated:     time.Now(),
		},
	}

	if setViewAndEditPermissions {
		items = append(items,
			&dashboards.DashboardACL{
				OrgID:       orgID,
				DashboardID: dashboardID,
				Role:        &rtEditor,
				Permission:  dashboards.PERMISSION_EDIT,
				Created:     time.Now(),
				Updated:     time.Now(),
			},
			&dashboards.DashboardACL{
				OrgID:       orgID,
				DashboardID: dashboardID,
				Role:        &rtViewer,
				Permission:  dashboards.PERMISSION_VIEW,
				Created:     time.Now(),
				Updated:     time.Now(),
			},
		)
	}

	if err := dr.dashboardStore.UpdateDashboardACL(ctx, dashboardID, items); err != nil {
		return err
	}

	return nil
}

// DeleteProvisionedDashboard removes dashboard from the DB even if it is provisioned.
func (dr *DashboardServiceImpl) DeleteProvisionedDashboard(ctx context.Context, dashboardId int64, orgId int64) error {
	return dr.deleteDashboard(ctx, dashboardId, orgId, false)
}

func (dr *DashboardServiceImpl) deleteDashboard(ctx context.Context, dashboardId int64, orgId int64, validateProvisionedDashboard bool) error {
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
	if err := validateDashboardRefreshInterval(dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for imported dashboard to minimum refresh interval",
			"dashboardUid", dto.Dashboard.UID, "dashboardTitle", dto.Dashboard.Title,
			"minRefreshInterval", setting.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", setting.MinRefreshInterval)
	}

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, false, true)
	if err != nil {
		return nil, err
	}

	dash, err := dr.dashboardStore.SaveDashboard(ctx, *cmd)
	if err != nil {
		return nil, err
	}

	if err := dr.setDefaultPermissions(ctx, dto, dash, false); err != nil {
		dr.log.Error("Could not make user admin", "dashboard", dash.Title, "user", dto.User.UserID, "error", err)
	}

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

func (dr *DashboardServiceImpl) setDefaultPermissions(ctx context.Context, dto *dashboards.SaveDashboardDTO, dash *dashboards.Dashboard, provisioned bool) error {
	inFolder := dash.FolderID > 0
	if !accesscontrol.IsDisabled(dr.cfg) {
		var permissions []accesscontrol.SetResourcePermissionCommand
		if !provisioned && dto.User.IsRealUser() && !dto.User.IsAnonymous {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: dto.User.UserID, Permission: dashboards.PERMISSION_ADMIN.String(),
			})
		}

		if !inFolder {
			permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
				{BuiltinRole: string(org.RoleEditor), Permission: dashboards.PERMISSION_EDIT.String()},
				{BuiltinRole: string(org.RoleViewer), Permission: dashboards.PERMISSION_VIEW.String()},
			}...)
		}

		svc := dr.dashboardPermissions
		if dash.IsFolder {
			svc = dr.folderPermissions
		}

		_, err := svc.SetPermissions(ctx, dto.OrgID, dash.UID, permissions...)
		if err != nil {
			return err
		}
	} else if dr.cfg.EditorsCanAdmin && !provisioned && dto.User.IsRealUser() && !dto.User.IsAnonymous {
		if err := dr.MakeUserAdmin(ctx, dto.OrgID, dto.User.UserID, dash.ID, !inFolder); err != nil {
			return err
		}
	}

	return nil
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

func (dr *DashboardServiceImpl) FindDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	return dr.dashboardStore.FindDashboards(ctx, query)
}

func (dr *DashboardServiceImpl) SearchDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) (model.HitList, error) {
	res, err := dr.FindDashboards(ctx, query)
	if err != nil {
		return nil, err
	}

	hits := makeQueryResult(query, res)

	return hits, nil
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
			hit = &model.Hit{
				ID:          item.ID,
				UID:         item.UID,
				Title:       item.Title,
				URI:         "db/" + item.Slug,
				URL:         dashboards.GetDashboardFolderURL(item.IsFolder, item.UID, item.Slug),
				Type:        getHitType(item),
				FolderID:    item.FolderID,
				FolderUID:   item.FolderUID,
				FolderTitle: item.FolderTitle,
				Tags:        []string{},
			}

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
	}
	return hitList
}

func (dr *DashboardServiceImpl) GetDashboardACLInfoList(ctx context.Context, query *dashboards.GetDashboardACLInfoListQuery) ([]*dashboards.DashboardACLInfoDTO, error) {
	return dr.dashboardStore.GetDashboardACLInfoList(ctx, query)
}

func (dr *DashboardServiceImpl) HasAdminPermissionInDashboardsOrFolders(ctx context.Context, query *folder.HasAdminPermissionInDashboardsOrFoldersQuery) (bool, error) {
	return dr.dashboardStore.HasAdminPermissionInDashboardsOrFolders(ctx, query)
}

func (dr *DashboardServiceImpl) HasEditPermissionInFolders(ctx context.Context, query *folder.HasEditPermissionInFoldersQuery) (bool, error) {
	return dr.dashboardStore.HasEditPermissionInFolders(ctx, query)
}

func (dr *DashboardServiceImpl) GetDashboardTags(ctx context.Context, query *dashboards.GetDashboardTagsQuery) ([]*dashboards.DashboardTagCloudItem, error) {
	return dr.dashboardStore.GetDashboardTags(ctx, query)
}

func (dr *DashboardServiceImpl) DeleteACLByUser(ctx context.Context, userID int64) error {
	return dr.dashboardStore.DeleteACLByUser(ctx, userID)
}

func (dr DashboardServiceImpl) CountDashboardsInFolder(ctx context.Context, query *dashboards.CountDashboardsInFolderQuery) (int64, error) {
	u, err := appcontext.User(ctx)
	if err != nil {
		return 0, err
	}

	folder, err := dr.folderService.Get(ctx, &folder.GetFolderQuery{UID: &query.FolderUID, OrgID: u.OrgID, SignedInUser: u})
	if err != nil {
		return 0, err
	}

	return dr.dashboardStore.CountDashboardsInFolder(ctx, &dashboards.CountDashboardsInFolderRequest{FolderID: folder.ID, OrgID: u.OrgID})
}

func (dr *DashboardServiceImpl) DeleteInFolder(ctx context.Context, orgID int64, UID string) error {
	return dr.dashboardStore.DeleteDashboardsInFolder(ctx, &dashboards.DeleteDashboardsInFolderRequest{FolderUID: UID, OrgID: orgID})
}

func (dr *DashboardServiceImpl) Kind() string { return entity.StandardKindDashboard }
