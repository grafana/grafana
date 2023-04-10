package guardian

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var permissionMap = map[string]dashboards.PermissionType{
	"View":  dashboards.PERMISSION_VIEW,
	"Edit":  dashboards.PERMISSION_EDIT,
	"Admin": dashboards.PERMISSION_ADMIN,
}

var _ DashboardGuardian = new(AccessControlDashboardGuardian)

// NewAccessControlDashboardGuardianByDashboard creates a dashboard guardian by the provided dashboardId.
func NewAccessControlDashboardGuardian(
	ctx context.Context, cfg *setting.Cfg, dashboardId int64, user *user.SignedInUser,
	store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService,
) (*AccessControlDashboardGuardian, error) {
	var dashboard *dashboards.Dashboard
	if dashboardId != 0 {
		q := &dashboards.GetDashboardQuery{
			ID:    dashboardId,
			OrgID: user.OrgID,
		}

		qResult, err := dashboardService.GetDashboard(ctx, q)
		if err != nil {
			if errors.Is(err, dashboards.ErrDashboardNotFound) {
				return nil, ErrGuardianDashboardNotFound.Errorf("failed to get dashboard by UID: %w", err)
			}
			return nil, ErrGuardianGetDashboardFailure.Errorf("failed to get dashboard by UID: %w", err)
		}
		dashboard = qResult
	}

	return &AccessControlDashboardGuardian{
		ctx:                         ctx,
		cfg:                         cfg,
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
	ctx context.Context, cfg *setting.Cfg, dashboardUID string, user *user.SignedInUser,
	store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService,
) (*AccessControlDashboardGuardian, error) {
	var dashboard *dashboards.Dashboard
	if dashboardUID != "" {
		q := &dashboards.GetDashboardQuery{
			UID:   dashboardUID,
			OrgID: user.OrgID,
		}

		qResult, err := dashboardService.GetDashboard(ctx, q)
		if err != nil {
			if errors.Is(err, dashboards.ErrDashboardNotFound) {
				return nil, ErrGuardianDashboardNotFound.Errorf("failed to get dashboard by UID: %w", err)
			}
			return nil, ErrGuardianGetDashboardFailure.Errorf("failed to get dashboard by UID: %w", err)
		}
		dashboard = qResult
	}

	return &AccessControlDashboardGuardian{
		cfg:                         cfg,
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
	ctx context.Context, cfg *setting.Cfg, dashboard *dashboards.Dashboard, user *user.SignedInUser,
	store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService,
) (*AccessControlDashboardGuardian, error) {
	return &AccessControlDashboardGuardian{
		cfg:                         cfg,
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
	cfg                         *setting.Cfg
	ctx                         context.Context
	log                         log.Logger
	dashboard                   *dashboards.Dashboard
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
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.dashboard.UID)))
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	)
}

func (a *AccessControlDashboardGuardian) CanEdit() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound
	}

	if a.cfg.ViewersCanEdit {
		return a.CanView()
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.dashboard.UID)))
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	)
}

func (a *AccessControlDashboardGuardian) CanView() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.dashboard.UID)))
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	)
}

func (a *AccessControlDashboardGuardian) CanAdmin() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalAll(
			accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.dashboard.UID)),
			accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.dashboard.UID)),
		))
	}

	return a.evaluate(accesscontrol.EvalAll(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsPermissionsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
		accesscontrol.EvalPermission(dashboards.ActionDashboardsPermissionsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	))
}

func (a *AccessControlDashboardGuardian) CanDelete() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersDelete, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.dashboard.UID)))
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsDelete, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
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
	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionDashboardsCreate, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.UID)))
}

func (a *AccessControlDashboardGuardian) evaluate(evaluator accesscontrol.Evaluator) (bool, error) {
	ok, err := a.ac.Evaluate(a.ctx, a.user, evaluator)
	if err != nil {
		id := 0
		if a.dashboard != nil {
			id = int(a.dashboard.ID)
		}
		a.log.Debug("Failed to evaluate access control to folder or dashboard", "error", err, "userId", a.user.UserID, "id", id)
	}

	if !ok && err == nil {
		id := 0
		if a.dashboard != nil {
			id = int(a.dashboard.ID)
		}
		a.log.Debug("Access denied to folder or dashboard", "userId", a.user.UserID, "id", id, "permissions", evaluator.GoString())
	}

	return ok, err
}

func (a *AccessControlDashboardGuardian) CheckPermissionBeforeUpdate(permission dashboards.PermissionType, updatePermissions []*dashboards.DashboardACL) (bool, error) {
	// always true for access control
	return true, nil
}

// GetACL translate access control permissions to dashboard acl info
func (a *AccessControlDashboardGuardian) GetACL() ([]*dashboards.DashboardACLInfoDTO, error) {
	if a.dashboard == nil {
		return nil, ErrGuardianGetDashboardFailure
	}

	var svc accesscontrol.PermissionsService
	if a.dashboard.IsFolder {
		svc = a.folderPermissionsService
	} else {
		svc = a.dashboardPermissionsService
	}

	permissions, err := svc.GetPermissions(a.ctx, a.user, a.dashboard.UID)
	if err != nil {
		return nil, err
	}

	acl := make([]*dashboards.DashboardACLInfoDTO, 0, len(permissions))
	for _, p := range permissions {
		if !p.IsManaged {
			continue
		}

		var role *org.RoleType
		if p.BuiltInRole != "" {
			tmp := org.RoleType(p.BuiltInRole)
			role = &tmp
		}

		acl = append(acl, &dashboards.DashboardACLInfoDTO{
			OrgID:          a.dashboard.OrgID,
			DashboardID:    a.dashboard.ID,
			FolderID:       a.dashboard.FolderID,
			Created:        p.Created,
			Updated:        p.Updated,
			UserID:         p.UserId,
			UserLogin:      p.UserLogin,
			UserEmail:      p.UserEmail,
			TeamID:         p.TeamId,
			TeamEmail:      p.TeamEmail,
			Team:           p.Team,
			Role:           role,
			Permission:     permissionMap[svc.MapActions(p)],
			PermissionName: permissionMap[svc.MapActions(p)].String(),
			UID:            a.dashboard.UID,
			Title:          a.dashboard.Title,
			Slug:           a.dashboard.Slug,
			IsFolder:       a.dashboard.IsFolder,
			URL:            a.dashboard.GetURL(),
			Inherited:      false,
		})
	}

	return acl, nil
}

func (a *AccessControlDashboardGuardian) GetACLWithoutDuplicates() ([]*dashboards.DashboardACLInfoDTO, error) {
	return a.GetACL()
}

func (a *AccessControlDashboardGuardian) GetHiddenACL(cfg *setting.Cfg) ([]*dashboards.DashboardACL, error) {
	var hiddenACL []*dashboards.DashboardACL
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
			hiddenACL = append(hiddenACL, &dashboards.DashboardACL{
				OrgID:       item.OrgID,
				DashboardID: item.DashboardID,
				UserID:      item.UserID,
				TeamID:      item.TeamID,
				Role:        item.Role,
				Permission:  item.Permission,
				Created:     item.Created,
				Updated:     item.Updated,
			})
		}
	}

	return hiddenACL, nil
}

func (a *AccessControlDashboardGuardian) loadParentFolder(folderID int64) (*dashboards.Dashboard, error) {
	if folderID == 0 {
		return &dashboards.Dashboard{UID: accesscontrol.GeneralFolderUID}, nil
	}
	folderQuery := &dashboards.GetDashboardQuery{ID: folderID, OrgID: a.user.OrgID}
	folderQueryResult, err := a.dashboardService.GetDashboard(a.ctx, folderQuery)
	if err != nil {
		return nil, err
	}
	return folderQueryResult, nil
}
