package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	provisionerPermissions = map[string][]string{
		dashboards.ActionFoldersCreate:    {},
		dashboards.ActionFoldersWrite:     {dashboards.ScopeFoldersAll},
		dashboards.ActionDashboardsCreate: {dashboards.ScopeFoldersAll},
		dashboards.ActionDashboardsWrite:  {dashboards.ScopeFoldersAll},
	}
	// DashboardServiceImpl implements the DashboardService interface
	_ dashboards.DashboardService = (*DashboardServiceImpl)(nil)
)

type DashboardServiceImpl struct {
	cfg                  *setting.Cfg
	log                  log.Logger
	dashboardStore       dashboards.Store
	dashAlertExtractor   alerting.DashAlertExtractor
	features             featuremgmt.FeatureToggles
	folderPermissions    accesscontrol.FolderPermissionsService
	dashboardPermissions accesscontrol.DashboardPermissionsService
	ac                   accesscontrol.AccessControl
}

func ProvideDashboardService(
	cfg *setting.Cfg, store dashboards.Store, dashAlertExtractor alerting.DashAlertExtractor,
	features featuremgmt.FeatureToggles, folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService, ac accesscontrol.AccessControl,
) *DashboardServiceImpl {
	ac.RegisterScopeAttributeResolver(dashboards.NewDashboardIDScopeResolver(store))
	ac.RegisterScopeAttributeResolver(dashboards.NewDashboardUIDScopeResolver(store))

	return &DashboardServiceImpl{
		cfg:                  cfg,
		log:                  log.New("dashboard-service"),
		dashboardStore:       store,
		dashAlertExtractor:   dashAlertExtractor,
		features:             features,
		folderPermissions:    folderPermissionsService,
		dashboardPermissions: dashboardPermissionsService,
		ac:                   ac,
	}
}

func (dr *DashboardServiceImpl) GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error) {
	return dr.dashboardStore.GetProvisionedDashboardData(name)
}

func (dr *DashboardServiceImpl) GetProvisionedDashboardDataByDashboardID(dashboardID int64) (*models.DashboardProvisioning, error) {
	return dr.dashboardStore.GetProvisionedDataByDashboardID(dashboardID)
}

func (dr *DashboardServiceImpl) GetProvisionedDashboardDataByDashboardUID(orgID int64, dashboardUID string) (*models.DashboardProvisioning, error) {
	return dr.dashboardStore.GetProvisionedDataByDashboardUID(orgID, dashboardUID)
}

func (dr *DashboardServiceImpl) BuildSaveDashboardCommand(ctx context.Context, dto *dashboards.SaveDashboardDTO, shouldValidateAlerts bool,
	validateProvisionedDashboard bool) (*models.SaveDashboardCommand, error) {
	dash := dto.Dashboard

	dash.OrgId = dto.OrgId
	dash.Title = strings.TrimSpace(dash.Title)
	dash.Data.Set("title", dash.Title)
	dash.SetUid(strings.TrimSpace(dash.Uid))

	if dash.Title == "" {
		return nil, dashboards.ErrDashboardTitleEmpty
	}

	if dash.IsFolder && dash.FolderId > 0 {
		return nil, dashboards.ErrDashboardFolderCannotHaveParent
	}

	if dash.IsFolder && strings.EqualFold(dash.Title, models.RootFolderName) {
		return nil, dashboards.ErrDashboardFolderNameExists
	}

	if !util.IsValidShortUID(dash.Uid) {
		return nil, dashboards.ErrDashboardInvalidUid
	} else if util.IsShortUIDTooLong(dash.Uid) {
		return nil, dashboards.ErrDashboardUidTooLong
	}

	if err := validateDashboardRefreshInterval(dash); err != nil {
		return nil, err
	}

	if shouldValidateAlerts {
		dashAlertInfo := alerting.DashAlertInfo{Dash: dash, User: dto.User, OrgID: dash.OrgId}
		if err := dr.dashAlertExtractor.ValidateAlerts(ctx, dashAlertInfo); err != nil {
			return nil, err
		}
	}

	isParentFolderChanged, err := dr.dashboardStore.ValidateDashboardBeforeSave(dash, dto.Overwrite)
	if err != nil {
		return nil, err
	}

	if isParentFolderChanged {
		// Check that the user is allowed to add a dashboard to the folder
		guardian := guardian.New(ctx, dash.Id, dto.OrgId, dto.User)
		if canSave, err := guardian.CanCreate(dash.FolderId, dash.IsFolder); err != nil || !canSave {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	}

	if validateProvisionedDashboard {
		provisionedData, err := dr.GetProvisionedDashboardDataByDashboardID(dash.Id)
		if err != nil {
			return nil, err
		}

		if provisionedData != nil {
			return nil, dashboards.ErrDashboardCannotSaveProvisionedDashboard
		}
	}

	guard := guardian.New(ctx, dash.GetDashboardIdForSavePermissionCheck(), dto.OrgId, dto.User)
	if dash.Id == 0 {
		if canCreate, err := guard.CanCreate(dash.FolderId, dash.IsFolder); err != nil || !canCreate {
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

	cmd := &models.SaveDashboardCommand{
		Dashboard: dash.Data,
		Message:   dto.Message,
		OrgId:     dto.OrgId,
		Overwrite: dto.Overwrite,
		UserId:    dto.User.UserID,
		FolderId:  dash.FolderId,
		IsFolder:  dash.IsFolder,
		PluginId:  dash.PluginId,
	}

	if !dto.UpdatedAt.IsZero() {
		cmd.UpdatedAt = dto.UpdatedAt
	}

	return cmd, nil
}

func (dr *DashboardServiceImpl) UpdateDashboardACL(ctx context.Context, uid int64, items []*models.DashboardACL) error {
	return dr.dashboardStore.UpdateDashboardACL(ctx, uid, items)
}

func (dr *DashboardServiceImpl) DeleteOrphanedProvisionedDashboards(ctx context.Context, cmd *models.DeleteOrphanedProvisionedDashboardsCommand) error {
	return dr.dashboardStore.DeleteOrphanedProvisionedDashboards(ctx, cmd)
}

func validateDashboardRefreshInterval(dash *models.Dashboard) error {
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
	provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	if err := validateDashboardRefreshInterval(dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for provisioned dashboard to minimum refresh interval", "dashboardUid",
			dto.Dashboard.Uid, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval", setting.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", setting.MinRefreshInterval)
	}

	dto.User = &user.SignedInUser{
		UserID:  0,
		OrgRole: org.RoleAdmin,
		OrgID:   dto.OrgId,
		Permissions: map[int64]map[string][]string{
			dto.OrgId: provisionerPermissions,
		},
	}

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, setting.IsLegacyAlertingEnabled(), false)
	if err != nil {
		return nil, err
	}

	// dashboard
	dash, err := dr.dashboardStore.SaveProvisionedDashboard(*cmd, provisioning)
	if err != nil {
		return nil, err
	}

	// alerts
	dashAlertInfo := alerting.DashAlertInfo{
		User:  dto.User,
		Dash:  dash,
		OrgID: dto.OrgId,
	}

	// extract/save legacy alerts only if legacy alerting is enabled
	if setting.IsLegacyAlertingEnabled() {
		alerts, err := dr.dashAlertExtractor.GetAlerts(ctx, dashAlertInfo)
		if err != nil {
			return nil, err
		}

		err = dr.dashboardStore.SaveAlerts(ctx, dash.Id, alerts)
		if err != nil {
			return nil, err
		}
	}

	if dto.Dashboard.Id == 0 {
		if err := dr.setDefaultPermissions(ctx, dto, dash, true); err != nil {
			dr.log.Error("Could not make user admin", "dashboard", dash.Title, "user", dto.User.UserID, "error", err)
		}
	}

	return dash, nil
}

func (dr *DashboardServiceImpl) SaveFolderForProvisionedDashboards(ctx context.Context, dto *dashboards.SaveDashboardDTO) (*models.Dashboard, error) {
	dto.User = &user.SignedInUser{
		UserID:      0,
		OrgRole:     org.RoleAdmin,
		OrgID:       dto.OrgId,
		Permissions: map[int64]map[string][]string{dto.OrgId: provisionerPermissions},
	}
	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, false, false)
	if err != nil {
		return nil, err
	}

	dash, err := dr.dashboardStore.SaveDashboard(*cmd)
	if err != nil {
		return nil, err
	}

	dashAlertInfo := alerting.DashAlertInfo{
		User:  dto.User,
		Dash:  dash,
		OrgID: dto.OrgId,
	}

	// extract/save legacy alerts only if legacy alerting is enabled
	if setting.IsLegacyAlertingEnabled() {
		alerts, err := dr.dashAlertExtractor.GetAlerts(ctx, dashAlertInfo)
		if err != nil {
			return nil, err
		}

		err = dr.dashboardStore.SaveAlerts(ctx, dash.Id, alerts)
		if err != nil {
			return nil, err
		}
	}

	if dto.Dashboard.Id == 0 {
		if err := dr.setDefaultPermissions(ctx, dto, dash, true); err != nil {
			dr.log.Error("Could not make user admin", "dashboard", dash.Title, "user", dto.User.UserID, "error", err)
		}
	}

	return dash, nil
}

func (dr *DashboardServiceImpl) SaveDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO,
	allowUiUpdate bool) (*models.Dashboard, error) {
	if err := validateDashboardRefreshInterval(dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for imported dashboard to minimum refresh interval",
			"dashboardUid", dto.Dashboard.Uid, "dashboardTitle", dto.Dashboard.Title, "minRefreshInterval",
			setting.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", setting.MinRefreshInterval)
	}

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, setting.IsLegacyAlertingEnabled(), !allowUiUpdate)
	if err != nil {
		return nil, err
	}

	dash, err := dr.dashboardStore.SaveDashboard(*cmd)
	if err != nil {
		return nil, fmt.Errorf("saving dashboard failed: %w", err)
	}

	dashAlertInfo := alerting.DashAlertInfo{
		User:  dto.User,
		Dash:  dash,
		OrgID: dto.OrgId,
	}

	// extract/save legacy alerts only if legacy alerting is enabled
	if setting.IsLegacyAlertingEnabled() {
		alerts, err := dr.dashAlertExtractor.GetAlerts(ctx, dashAlertInfo)
		if err != nil {
			return nil, err
		}

		err = dr.dashboardStore.SaveAlerts(ctx, dash.Id, alerts)
		if err != nil {
			return nil, err
		}
	}

	// new dashboard created
	if dto.Dashboard.Id == 0 {
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

func (dr *DashboardServiceImpl) GetDashboardByPublicUid(ctx context.Context, dashboardPublicUid string) (*models.Dashboard, error) {
	return nil, nil
}

func (dr *DashboardServiceImpl) MakeUserAdmin(ctx context.Context, orgID int64, userID int64, dashboardID int64, setViewAndEditPermissions bool) error {
	rtEditor := org.RoleEditor
	rtViewer := org.RoleViewer

	items := []*models.DashboardACL{
		{
			OrgID:       orgID,
			DashboardID: dashboardID,
			UserID:      userID,
			Permission:  models.PERMISSION_ADMIN,
			Created:     time.Now(),
			Updated:     time.Now(),
		},
	}

	if setViewAndEditPermissions {
		items = append(items,
			&models.DashboardACL{
				OrgID:       orgID,
				DashboardID: dashboardID,
				Role:        &rtEditor,
				Permission:  models.PERMISSION_EDIT,
				Created:     time.Now(),
				Updated:     time.Now(),
			},
			&models.DashboardACL{
				OrgID:       orgID,
				DashboardID: dashboardID,
				Role:        &rtViewer,
				Permission:  models.PERMISSION_VIEW,
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
		provisionedData, err := dr.GetProvisionedDashboardDataByDashboardID(dashboardId)
		if err != nil {
			return fmt.Errorf("%v: %w", "failed to check if dashboard is provisioned", err)
		}

		if provisionedData != nil {
			return dashboards.ErrDashboardCannotDeleteProvisionedDashboard
		}
	}
	cmd := &models.DeleteDashboardCommand{OrgId: orgId, Id: dashboardId}
	return dr.dashboardStore.DeleteDashboard(ctx, cmd)
}

func (dr *DashboardServiceImpl) ImportDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO) (
	*models.Dashboard, error) {
	if err := validateDashboardRefreshInterval(dto.Dashboard); err != nil {
		dr.log.Warn("Changing refresh interval for imported dashboard to minimum refresh interval",
			"dashboardUid", dto.Dashboard.Uid, "dashboardTitle", dto.Dashboard.Title,
			"minRefreshInterval", setting.MinRefreshInterval)
		dto.Dashboard.Data.Set("refresh", setting.MinRefreshInterval)
	}

	cmd, err := dr.BuildSaveDashboardCommand(ctx, dto, false, true)
	if err != nil {
		return nil, err
	}

	dash, err := dr.dashboardStore.SaveDashboard(*cmd)
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

func (dr *DashboardServiceImpl) GetDashboardsByPluginID(ctx context.Context, query *models.GetDashboardsByPluginIdQuery) error {
	return dr.dashboardStore.GetDashboardsByPluginID(ctx, query)
}

func (dr *DashboardServiceImpl) setDefaultPermissions(ctx context.Context, dto *dashboards.SaveDashboardDTO, dash *models.Dashboard, provisioned bool) error {
	inFolder := dash.FolderId > 0
	if !accesscontrol.IsDisabled(dr.cfg) {
		var permissions []accesscontrol.SetResourcePermissionCommand
		if !provisioned && dto.User.IsRealUser() && !dto.User.IsAnonymous {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: dto.User.UserID, Permission: models.PERMISSION_ADMIN.String(),
			})
		}

		if !inFolder {
			permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
				{BuiltinRole: string(org.RoleEditor), Permission: models.PERMISSION_EDIT.String()},
				{BuiltinRole: string(org.RoleViewer), Permission: models.PERMISSION_VIEW.String()},
			}...)
		}

		svc := dr.dashboardPermissions
		if dash.IsFolder {
			svc = dr.folderPermissions
		}

		_, err := svc.SetPermissions(ctx, dto.OrgId, dash.Uid, permissions...)
		if err != nil {
			return err
		}
	} else if dr.cfg.EditorsCanAdmin && !provisioned && dto.User.IsRealUser() && !dto.User.IsAnonymous {
		if err := dr.MakeUserAdmin(ctx, dto.OrgId, dto.User.UserID, dash.Id, !inFolder); err != nil {
			return err
		}
	}

	return nil
}

func (dr *DashboardServiceImpl) GetDashboard(ctx context.Context, query *models.GetDashboardQuery) error {
	_, err := dr.dashboardStore.GetDashboard(ctx, query)
	return err
}

func (dr *DashboardServiceImpl) GetDashboardUIDById(ctx context.Context, query *models.GetDashboardRefByIdQuery) error {
	return dr.dashboardStore.GetDashboardUIDById(ctx, query)
}

func (dr *DashboardServiceImpl) GetDashboards(ctx context.Context, query *models.GetDashboardsQuery) error {
	return dr.dashboardStore.GetDashboards(ctx, query)
}

func (dr *DashboardServiceImpl) FindDashboards(ctx context.Context, query *models.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	return dr.dashboardStore.FindDashboards(ctx, query)
}

func (dr *DashboardServiceImpl) SearchDashboards(ctx context.Context, query *models.FindPersistedDashboardsQuery) error {
	res, err := dr.FindDashboards(ctx, query)
	if err != nil {
		return err
	}

	makeQueryResult(query, res)

	return nil
}

func getHitType(item dashboards.DashboardSearchProjection) models.HitType {
	var hitType models.HitType
	if item.IsFolder {
		hitType = models.DashHitFolder
	} else {
		hitType = models.DashHitDB
	}

	return hitType
}

func makeQueryResult(query *models.FindPersistedDashboardsQuery, res []dashboards.DashboardSearchProjection) {
	query.Result = make([]*models.Hit, 0)
	hits := make(map[int64]*models.Hit)

	for _, item := range res {
		hit, exists := hits[item.ID]
		if !exists {
			hit = &models.Hit{
				ID:          item.ID,
				UID:         item.UID,
				Title:       item.Title,
				URI:         "db/" + item.Slug,
				URL:         models.GetDashboardFolderUrl(item.IsFolder, item.UID, item.Slug),
				Type:        getHitType(item),
				FolderID:    item.FolderID,
				FolderUID:   item.FolderUID,
				FolderTitle: item.FolderTitle,
				Tags:        []string{},
			}

			if item.FolderID > 0 {
				hit.FolderURL = models.GetFolderUrl(item.FolderUID, item.FolderSlug)
			}

			if query.Sort.MetaName != "" {
				hit.SortMeta = item.SortMeta
				hit.SortMetaName = query.Sort.MetaName
			}

			query.Result = append(query.Result, hit)
			hits[item.ID] = hit
		}
		if len(item.Term) > 0 {
			hit.Tags = append(hit.Tags, item.Term)
		}
	}
}

func (dr *DashboardServiceImpl) GetDashboardACLInfoList(ctx context.Context, query *models.GetDashboardACLInfoListQuery) error {
	return dr.dashboardStore.GetDashboardACLInfoList(ctx, query)
}

func (dr *DashboardServiceImpl) HasAdminPermissionInDashboardsOrFolders(ctx context.Context, query *models.HasAdminPermissionInDashboardsOrFoldersQuery) error {
	return dr.dashboardStore.HasAdminPermissionInDashboardsOrFolders(ctx, query)
}

func (dr *DashboardServiceImpl) HasEditPermissionInFolders(ctx context.Context, query *models.HasEditPermissionInFoldersQuery) error {
	return dr.dashboardStore.HasEditPermissionInFolders(ctx, query)
}

func (dr *DashboardServiceImpl) GetDashboardTags(ctx context.Context, query *models.GetDashboardTagsQuery) error {
	return dr.dashboardStore.GetDashboardTags(ctx, query)
}

func (dr *DashboardServiceImpl) DeleteACLByUser(ctx context.Context, userID int64) error {
	return dr.dashboardStore.DeleteACLByUser(ctx, userID)
}
