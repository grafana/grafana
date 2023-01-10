package guardian

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var permissionMap = map[string]models.PermissionType{
	"View":  models.PERMISSION_VIEW,
	"Edit":  models.PERMISSION_EDIT,
	"Admin": models.PERMISSION_ADMIN,
}

var _ DashboardGuardian = new(AccessControlDashboardGuardian)

// NewAccessControlDashboardGuardianByDashboard creates a dashboard guardian by the provided dashboardId.
func NewAccessControlDashboardGuardian(
	ctx context.Context, dashboardId int64, user *user.SignedInUser,
	store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService,
) (*AccessControlDashboardGuardian, error) {
	var dashboard *models.Dashboard
	if dashboardId != 0 {
		q := &models.GetDashboardQuery{
			Id:    dashboardId,
			OrgId: user.OrgID,
		}

		if err := dashboardService.GetDashboard(ctx, q); err != nil {
			if errors.Is(err, dashboards.ErrDashboardNotFound) {
				return nil, ErrGuardianDashboardNotFound.Errorf("failed to get dashboard by UID: %w", err)
			}
			return nil, ErrGuardianGetDashboardFailure.Errorf("failed to get dashboard by UID: %w", err)
		}
		dashboard = q.Result
	}

	return &AccessControlDashboardGuardian{
		ctx:                         ctx,
		log:                         log.New("dashboard.permissions"),
		dashboard:                   dashboard,
		user:                        user,
		store:                       store,
		ac:                          ac,
		folderPermissionsService:    folderPermissionsService,
		dashboardPermissionsService: dashboardPermissionsService,
		dashboardService:            dashboardService,
	}, nil
}

// NewAccessControlDashboardGuardianByDashboard creates a dashboard guardian by the provided dashboardUID.
func NewAccessControlDashboardGuardianByUID(
	ctx context.Context, dashboardUID string, user *user.SignedInUser,
	store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService,
) (*AccessControlDashboardGuardian, error) {
	var dashboard *models.Dashboard
	if dashboardUID != "" {
		q := &models.GetDashboardQuery{
			Uid:   dashboardUID,
			OrgId: user.OrgID,
		}

		if err := dashboardService.GetDashboard(ctx, q); err != nil {
			if errors.Is(err, dashboards.ErrDashboardNotFound) {
				return nil, ErrGuardianDashboardNotFound.Errorf("failed to get dashboard by UID: %w", err)
			}
			return nil, ErrGuardianGetDashboardFailure.Errorf("failed to get dashboard by UID: %w", err)
		}
		dashboard = q.Result
	}

	return &AccessControlDashboardGuardian{
		ctx:                         ctx,
		log:                         log.New("dashboard.permissions"),
		dashboard:                   dashboard,
		user:                        user,
		store:                       store,
		ac:                          ac,
		folderPermissionsService:    folderPermissionsService,
		dashboardPermissionsService: dashboardPermissionsService,
		dashboardService:            dashboardService,
	}, nil
}

// NewAccessControlDashboardGuardianByDashboard creates a dashboard guardian by the provided dashboard.
// This constructor should be preferred over the other two if the dashboard in available
// since it avoids querying the database for fetching the dashboard.
func NewAccessControlDashboardGuardianByDashboard(
	ctx context.Context, dashboard *models.Dashboard, user *user.SignedInUser,
	store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService,
) (*AccessControlDashboardGuardian, error) {
	return &AccessControlDashboardGuardian{
		ctx:                         ctx,
		log:                         log.New("dashboard.permissions"),
		dashboard:                   dashboard,
		user:                        user,
		store:                       store,
		ac:                          ac,
		folderPermissionsService:    folderPermissionsService,
		dashboardPermissionsService: dashboardPermissionsService,
		dashboardService:            dashboardService,
	}, nil
}

type AccessControlDashboardGuardian struct {
	ctx                         context.Context
	log                         log.Logger
	dashboard                   *models.Dashboard
	user                        *user.SignedInUser
	store                       db.DB
	ac                          accesscontrol.AccessControl
	folderPermissionsService    accesscontrol.FolderPermissionsService
	dashboardPermissionsService accesscontrol.DashboardPermissionsService
	dashboardService            dashboards.DashboardService
}

func (a *AccessControlDashboardGuardian) CanSave() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.dashboard.Uid)))
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.Uid)),
	)
}

func (a *AccessControlDashboardGuardian) CanEdit() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound
	}

	if setting.ViewersCanEdit {
		return a.CanView()
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.dashboard.Uid)))
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.Uid)),
	)
}

func (a *AccessControlDashboardGuardian) CanView() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.dashboard.Uid)))
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.Uid)),
	)
}

func (a *AccessControlDashboardGuardian) CanAdmin() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalAll(
			accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.dashboard.Uid)),
			accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.dashboard.Uid)),
		))
	}

	return a.evaluate(accesscontrol.EvalAll(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsPermissionsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.Uid)),
		accesscontrol.EvalPermission(dashboards.ActionDashboardsPermissionsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.Uid)),
	))
}

func (a *AccessControlDashboardGuardian) CanDelete() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersDelete, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.dashboard.Uid)))
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsDelete, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.Uid)),
	)
}

func (a *AccessControlDashboardGuardian) CanCreate(folderID int64, isFolder bool) (bool, error) {
	if isFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersCreate))
	}
	folder, err := a.loadParentFolder(folderID)
	if err != nil {
		return false, err
	}
	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionDashboardsCreate, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.Uid)))
}

func (a *AccessControlDashboardGuardian) evaluate(evaluator accesscontrol.Evaluator) (bool, error) {
	ok, err := a.ac.Evaluate(a.ctx, a.user, evaluator)
	if err != nil {
		a.log.Debug("Failed to evaluate access control to folder or dashboard", "error", err, "userId", a.user.UserID, "id", a.dashboard.Id)
	}

	if !ok && err == nil {
		a.log.Debug("Access denied to folder or dashboard", "userId", a.user.UserID, "id", a.dashboard.Id, "permissions", evaluator.GoString())
	}

	return ok, err
}

func (a *AccessControlDashboardGuardian) CheckPermissionBeforeUpdate(permission models.PermissionType, updatePermissions []*models.DashboardACL) (bool, error) {
	// always true for access control
	return true, nil
}

// GetACL translate access control permissions to dashboard acl info
func (a *AccessControlDashboardGuardian) GetACL() ([]*models.DashboardACLInfoDTO, error) {
	if a.dashboard == nil {
		return nil, ErrGuardianGetDashboardFailure
	}

	var svc accesscontrol.PermissionsService
	if a.dashboard.IsFolder {
		svc = a.folderPermissionsService
	} else {
		svc = a.dashboardPermissionsService
	}

	permissions, err := svc.GetPermissions(a.ctx, a.user, a.dashboard.Uid)
	if err != nil {
		return nil, err
	}

	acl := make([]*models.DashboardACLInfoDTO, 0, len(permissions))
	for _, p := range permissions {
		if !p.IsManaged {
			continue
		}

		var role *org.RoleType
		if p.BuiltInRole != "" {
			tmp := org.RoleType(p.BuiltInRole)
			role = &tmp
		}

		acl = append(acl, &models.DashboardACLInfoDTO{
			OrgId:          a.dashboard.OrgId,
			DashboardId:    a.dashboard.Id,
			FolderId:       a.dashboard.FolderId,
			Created:        p.Created,
			Updated:        p.Updated,
			UserId:         p.UserId,
			UserLogin:      p.UserLogin,
			UserEmail:      p.UserEmail,
			TeamId:         p.TeamId,
			TeamEmail:      p.TeamEmail,
			Team:           p.Team,
			Role:           role,
			Permission:     permissionMap[svc.MapActions(p)],
			PermissionName: permissionMap[svc.MapActions(p)].String(),
			Uid:            a.dashboard.Uid,
			Title:          a.dashboard.Title,
			Slug:           a.dashboard.Slug,
			IsFolder:       a.dashboard.IsFolder,
			Url:            a.dashboard.GetUrl(),
			Inherited:      false,
		})
	}

	return acl, nil
}

func (a *AccessControlDashboardGuardian) GetACLWithoutDuplicates() ([]*models.DashboardACLInfoDTO, error) {
	return a.GetACL()
}

func (a *AccessControlDashboardGuardian) GetHiddenACL(cfg *setting.Cfg) ([]*models.DashboardACL, error) {
	var hiddenACL []*models.DashboardACL
	if a.user.IsGrafanaAdmin {
		return hiddenACL, nil
	}

	existingPermissions, err := a.GetACL()
	if err != nil {
		return hiddenACL, err
	}

	for _, item := range existingPermissions {
		if item.Inherited || item.UserLogin == a.user.Login {
			continue
		}

		if _, hidden := cfg.HiddenUsers[item.UserLogin]; hidden {
			hiddenACL = append(hiddenACL, &models.DashboardACL{
				OrgID:       item.OrgId,
				DashboardID: item.DashboardId,
				UserID:      item.UserId,
				TeamID:      item.TeamId,
				Role:        item.Role,
				Permission:  item.Permission,
				Created:     item.Created,
				Updated:     item.Updated,
			})
		}
	}

	return hiddenACL, nil
}

func (a *AccessControlDashboardGuardian) loadParentFolder(folderID int64) (*models.Dashboard, error) {
	if folderID == 0 {
		return &models.Dashboard{Uid: accesscontrol.GeneralFolderUID}, nil
	}
	folderQuery := &models.GetDashboardQuery{Id: folderID, OrgId: a.user.OrgID}
	if err := a.dashboardService.GetDashboard(a.ctx, folderQuery); err != nil {
		return nil, err
	}
	return folderQuery.Result, nil
}
