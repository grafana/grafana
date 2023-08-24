package guardian

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

var permissionMap = map[string]dashboards.PermissionType{
	"View":  dashboards.PERMISSION_VIEW,
	"Edit":  dashboards.PERMISSION_EDIT,
	"Admin": dashboards.PERMISSION_ADMIN,
}

var _ DashboardGuardian = new(accessControlDashboardGuardian)

// NewAccessControlDashboardGuardianByDashboard creates a dashboard guardian by the provided dashboardId.
func NewAccessControlDashboardGuardian(
	ctx context.Context, cfg *setting.Cfg, dashboardId int64, user identity.Requester,
	store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService,
) (DashboardGuardian, error) {
	var dashboard *dashboards.Dashboard
	if dashboardId != 0 {
		q := &dashboards.GetDashboardQuery{
			ID:    dashboardId,
			OrgID: user.GetOrgID(),
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

	if dashboard != nil && dashboard.IsFolder {
		return &accessControlFolderGuardian{
			accessControlBaseGuardian: accessControlBaseGuardian{
				ctx:              ctx,
				cfg:              cfg,
				log:              log.New("folder.permissions"),
				user:             user,
				store:            store,
				ac:               ac,
				dashboardService: dashboardService,
			},
			folder:                   dashboards.FromDashboard(dashboard),
			folderPermissionsService: folderPermissionsService,
		}, nil
	}

	return &accessControlDashboardGuardian{
		accessControlBaseGuardian: accessControlBaseGuardian{
			ctx:              ctx,
			cfg:              cfg,
			log:              log.New("dashboard.permissions"),
			user:             user,
			store:            store,
			ac:               ac,
			dashboardService: dashboardService,
		},
		dashboard:                   dashboard,
		dashboardPermissionsService: dashboardPermissionsService,
	}, nil
}

// NewAccessControlDashboardGuardianByDashboard creates a dashboard guardian by the provided dashboardUID.
func NewAccessControlDashboardGuardianByUID(
	ctx context.Context, cfg *setting.Cfg, dashboardUID string, user identity.Requester,
	store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService,
) (DashboardGuardian, error) {
	var dashboard *dashboards.Dashboard
	if dashboardUID != "" {
		q := &dashboards.GetDashboardQuery{
			UID:   dashboardUID,
			OrgID: user.GetOrgID(),
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

	if dashboard != nil && dashboard.IsFolder {
		return &accessControlFolderGuardian{
			accessControlBaseGuardian: accessControlBaseGuardian{
				ctx:              ctx,
				cfg:              cfg,
				log:              log.New("folder.permissions"),
				user:             user,
				store:            store,
				ac:               ac,
				dashboardService: dashboardService,
			},
			folder:                   dashboards.FromDashboard(dashboard),
			folderPermissionsService: folderPermissionsService,
		}, nil
	}

	return &accessControlDashboardGuardian{
		accessControlBaseGuardian: accessControlBaseGuardian{
			cfg:              cfg,
			ctx:              ctx,
			log:              log.New("dashboard.permissions"),
			user:             user,
			store:            store,
			ac:               ac,
			dashboardService: dashboardService,
		},
		dashboard:                   dashboard,
		dashboardPermissionsService: dashboardPermissionsService,
	}, nil
}

// NewAccessControlDashboardGuardianByDashboard creates a dashboard guardian by the provided dashboard.
// This constructor should be preferred over the other two if the dashboard in available
// since it avoids querying the database for fetching the dashboard.
func NewAccessControlDashboardGuardianByDashboard(
	ctx context.Context, cfg *setting.Cfg, dashboard *dashboards.Dashboard, user identity.Requester,
	store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService,
) (DashboardGuardian, error) {
	if dashboard != nil && dashboard.IsFolder {
		return &accessControlFolderGuardian{
			accessControlBaseGuardian: accessControlBaseGuardian{
				ctx:              ctx,
				cfg:              cfg,
				log:              log.New("folder.permissions"),
				user:             user,
				store:            store,
				ac:               ac,
				dashboardService: dashboardService,
			},
			folder:                   dashboards.FromDashboard(dashboard),
			folderPermissionsService: folderPermissionsService,
		}, nil
	}

	return &accessControlDashboardGuardian{
		accessControlBaseGuardian: accessControlBaseGuardian{
			cfg:              cfg,
			ctx:              ctx,
			log:              log.New("dashboard.permissions"),
			user:             user,
			store:            store,
			ac:               ac,
			dashboardService: dashboardService,
		},
		dashboard:                   dashboard,
		dashboardPermissionsService: dashboardPermissionsService,
	}, nil
}

// NewAccessControlFolderGuardian creates a folder guardian by the provided folder.
func NewAccessControlFolderGuardian(
	ctx context.Context, cfg *setting.Cfg, f *folder.Folder, user identity.Requester,
	store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService,
) (DashboardGuardian, error) {
	return &accessControlFolderGuardian{
		accessControlBaseGuardian: accessControlBaseGuardian{
			ctx:              ctx,
			cfg:              cfg,
			log:              log.New("folder.permissions"),
			user:             user,
			store:            store,
			ac:               ac,
			dashboardService: dashboardService,
		},
		folder:                   f,
		folderPermissionsService: folderPermissionsService,
	}, nil
}

type accessControlBaseGuardian struct {
	cfg              *setting.Cfg
	ctx              context.Context
	log              log.Logger
	user             identity.Requester
	ac               accesscontrol.AccessControl
	store            db.DB
	dashboardService dashboards.DashboardService
}

type accessControlDashboardGuardian struct {
	accessControlBaseGuardian
	dashboard                   *dashboards.Dashboard
	dashboardPermissionsService accesscontrol.DashboardPermissionsService
}

type accessControlFolderGuardian struct {
	accessControlBaseGuardian
	folder                   *folder.Folder
	folderPermissionsService accesscontrol.FolderPermissionsService
}

func (a *accessControlDashboardGuardian) CanSave() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound.Errorf("failed to check save permissions for dashboard")
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	)
}

func (a *accessControlFolderGuardian) CanSave() (bool, error) {
	if a.folder == nil {
		return false, ErrGuardianFolderNotFound.Errorf("failed to check save permissions for folder")
	}

	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.folder.UID)))
}

func (a *accessControlDashboardGuardian) CanEdit() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound.Errorf("failed to check edit permissions for dashboard")
	}

	if a.cfg.ViewersCanEdit {
		return a.CanView()
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	)
}

func (a *accessControlFolderGuardian) CanEdit() (bool, error) {
	if a.folder == nil {
		return false, ErrGuardianFolderNotFound.Errorf("failed to check edit permissions for folder")
	}

	if a.cfg.ViewersCanEdit {
		return a.CanView()
	}

	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.folder.UID)))
}

func (a *accessControlDashboardGuardian) CanView() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound.Errorf("failed to check view permissions for dashboard")
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	)
}

func (a *accessControlFolderGuardian) CanView() (bool, error) {
	if a.folder == nil {
		return false, ErrGuardianFolderNotFound.Errorf("failed to check view permissions for folder")
	}

	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.folder.UID)))
}

func (a *accessControlDashboardGuardian) CanAdmin() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound.Errorf("failed to check admin permissions for dashboard")
	}

	return a.evaluate(accesscontrol.EvalAll(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsPermissionsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
		accesscontrol.EvalPermission(dashboards.ActionDashboardsPermissionsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	))
}

func (a *accessControlFolderGuardian) CanAdmin() (bool, error) {
	if a.folder == nil {
		return false, ErrGuardianFolderNotFound.Errorf("failed to check admin permissions for folder")
	}

	return a.evaluate(accesscontrol.EvalAll(
		accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.folder.UID)),
		accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.folder.UID)),
	))
}

func (a *accessControlDashboardGuardian) CanDelete() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound.Errorf("failed to check delete permissions for dashboard")
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsDelete, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	)
}

func (a *accessControlFolderGuardian) CanDelete() (bool, error) {
	if a.folder == nil {
		return false, ErrGuardianFolderNotFound.Errorf("failed to check delete permissions for folder")
	}

	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersDelete, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.folder.UID)))
}

func (a *accessControlDashboardGuardian) CanCreate(folderID int64, isFolder bool) (bool, error) {
	if isFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersCreate))
	}
	folder, err := a.loadParentFolder(folderID)
	if err != nil {
		return false, err
	}
	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionDashboardsCreate, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.UID)))
}

func (a *accessControlFolderGuardian) CanCreate(folderID int64, isFolder bool) (bool, error) {
	if isFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersCreate))
	}
	folder, err := a.loadParentFolder(folderID)
	if err != nil {
		return false, err
	}
	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionDashboardsCreate, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.UID)))
}

func (a *accessControlDashboardGuardian) evaluate(evaluator accesscontrol.Evaluator) (bool, error) {
	ok, err := a.ac.Evaluate(a.ctx, a.user, evaluator)
	namespaceID, userID := a.user.GetNamespacedID()
	if err != nil {
		id := 0
		if a.dashboard != nil {
			id = int(a.dashboard.ID)
		}
		a.log.Debug("Failed to evaluate access control to dashboard", "error", err, "namespaceID", namespaceID, "userId", userID, "id", id)
	}

	if !ok && err == nil {
		id := 0
		if a.dashboard != nil {
			id = int(a.dashboard.ID)
		}
		a.log.Debug("Access denied to dashboard", "namespaceID", namespaceID, "userId", userID, "id", id, "permissions", evaluator.GoString())
	}

	return ok, err
}

func (a *accessControlFolderGuardian) evaluate(evaluator accesscontrol.Evaluator) (bool, error) {
	ok, err := a.ac.Evaluate(a.ctx, a.user, evaluator)
	namespaceID, userID := a.user.GetNamespacedID()
	if err != nil {
		uid := ""
		orgID := 0
		if a.folder != nil {
			uid = a.folder.UID
			orgID = int(a.folder.OrgID)
		}
		a.log.Debug("Failed to evaluate access control to folder", "error", err, "namespaceID", namespaceID, "userId", userID, "orgID", orgID, "uid", uid)
	}

	if !ok && err == nil {
		uid := ""
		orgID := 0
		if a.folder != nil {
			uid = a.folder.UID
			orgID = int(a.folder.OrgID)
		}
		a.log.Debug("Access denied to folder", "namespaceID", namespaceID, "userId", userID, "orgID", orgID, "uid", uid, "permissions", evaluator.GoString())
	}

	return ok, err
}

func (a *accessControlBaseGuardian) CheckPermissionBeforeUpdate(permission dashboards.PermissionType, updatePermissions []*dashboards.DashboardACL) (bool, error) {
	// always true for access control
	return true, nil
}

// GetACL translate access control permissions to dashboard acl info
func (a *accessControlDashboardGuardian) GetACL() ([]*dashboards.DashboardACLInfoDTO, error) {
	if a.dashboard == nil {
		return nil, ErrGuardianGetDashboardFailure.Errorf("failed to translate access control permissions to dashboard acl info")
	}

	svc := a.dashboardPermissionsService

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

// GetACL translate access control permissions to dashboard acl info
func (a *accessControlFolderGuardian) GetACL() ([]*dashboards.DashboardACLInfoDTO, error) {
	if a.folder == nil {
		return nil, ErrGuardianGetFolderFailure.Errorf("failed to translate access control permissions to dashboard acl info")
	}

	svc := a.folderPermissionsService

	permissions, err := svc.GetPermissions(a.ctx, a.user, a.folder.UID)
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
			OrgID:          a.folder.OrgID,
			DashboardID:    a.folder.ID,
			FolderUID:      a.folder.ParentUID,
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
			UID:            a.folder.UID,
			Title:          a.folder.Title,
			//Slug:           a.folder.Slug,
			IsFolder:  true,
			URL:       a.folder.WithURL().URL,
			Inherited: false,
		})
	}

	return acl, nil
}

func (a *accessControlDashboardGuardian) GetACLWithoutDuplicates() ([]*dashboards.DashboardACLInfoDTO, error) {
	return a.GetACL()
}

func (a *accessControlFolderGuardian) GetACLWithoutDuplicates() ([]*dashboards.DashboardACLInfoDTO, error) {
	return a.GetACL()
}

func (a *accessControlDashboardGuardian) GetHiddenACL(cfg *setting.Cfg) ([]*dashboards.DashboardACL, error) {
	var hiddenACL []*dashboards.DashboardACL
	if a.user.GetIsGrafanaAdmin() {
		return hiddenACL, nil
	}

	existingPermissions, err := a.GetACL()
	if err != nil {
		return hiddenACL, err
	}

	for _, item := range existingPermissions {
		if item.Inherited || item.UserLogin == a.user.GetLogin() {
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

func (a *accessControlFolderGuardian) GetHiddenACL(cfg *setting.Cfg) ([]*dashboards.DashboardACL, error) {
	var hiddenACL []*dashboards.DashboardACL
	if a.user.GetIsGrafanaAdmin() {
		return hiddenACL, nil
	}

	existingPermissions, err := a.GetACL()
	if err != nil {
		return hiddenACL, err
	}

	for _, item := range existingPermissions {
		if item.Inherited || item.UserLogin == a.user.GetLogin() {
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

func (a *accessControlDashboardGuardian) loadParentFolder(folderID int64) (*dashboards.Dashboard, error) {
	if folderID == 0 {
		return &dashboards.Dashboard{UID: accesscontrol.GeneralFolderUID}, nil
	}
	folderQuery := &dashboards.GetDashboardQuery{ID: folderID, OrgID: a.user.GetOrgID()}
	folderQueryResult, err := a.dashboardService.GetDashboard(a.ctx, folderQuery)
	if err != nil {
		return nil, err
	}
	return folderQueryResult, nil
}

func (a *accessControlFolderGuardian) loadParentFolder(folderID int64) (*dashboards.Dashboard, error) {
	if folderID == 0 {
		return &dashboards.Dashboard{UID: accesscontrol.GeneralFolderUID}, nil
	}
	folderQuery := &dashboards.GetDashboardQuery{ID: folderID, OrgID: a.user.GetOrgID()}
	folderQueryResult, err := a.dashboardService.GetDashboard(a.ctx, folderQuery)
	if err != nil {
		return nil, err
	}
	return folderQueryResult, nil
}
