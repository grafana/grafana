package guardian

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var permissionMap = map[string]models.PermissionType{
	"View":  models.PERMISSION_VIEW,
	"Edit":  models.PERMISSION_EDIT,
	"Admin": models.PERMISSION_ADMIN,
}

var _ DashboardGuardian = new(AccessControlDashboardGuardian)

func NewAccessControlDashboardGuardian(
	ctx context.Context, dashboardId int64, user *models.SignedInUser,
	store sqlstore.Store, ac accesscontrol.AccessControl, permissionsServices accesscontrol.PermissionsServices,
) *AccessControlDashboardGuardian {
	return &AccessControlDashboardGuardian{
		ctx:                ctx,
		log:                log.New("dashboard.permissions"),
		dashboardID:        dashboardId,
		user:               user,
		store:              store,
		ac:                 ac,
		permissionServices: permissionsServices,
	}
}

type AccessControlDashboardGuardian struct {
	ctx                context.Context
	log                log.Logger
	dashboardID        int64
	dashboard          *models.Dashboard
	user               *models.SignedInUser
	store              sqlstore.Store
	ac                 accesscontrol.AccessControl
	permissionServices accesscontrol.PermissionsServices
}

func (a *AccessControlDashboardGuardian) CanSave() (bool, error) {
	if err := a.loadDashboard(); err != nil {
		return false, err
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, folderScope(a.dashboardID)))
	}

	return a.evaluate(accesscontrol.EvalAny(
		accesscontrol.EvalPermission(accesscontrol.ActionDashboardsWrite, dashboardScope(a.dashboard.Id)),
		accesscontrol.EvalPermission(accesscontrol.ActionDashboardsWrite, folderScope(a.dashboard.FolderId)),
	))
}

func (a *AccessControlDashboardGuardian) CanEdit() (bool, error) {
	if err := a.loadDashboard(); err != nil {
		return false, err
	}

	if setting.ViewersCanEdit {
		return a.CanView()
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, folderScope(a.dashboardID)))
	}

	return a.evaluate(accesscontrol.EvalAny(
		accesscontrol.EvalPermission(accesscontrol.ActionDashboardsWrite, dashboardScope(a.dashboard.Id)),
		accesscontrol.EvalPermission(accesscontrol.ActionDashboardsWrite, folderScope(a.dashboard.FolderId)),
	))
}

func (a *AccessControlDashboardGuardian) CanView() (bool, error) {
	if err := a.loadDashboard(); err != nil {
		return false, err
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersRead, folderScope(a.dashboardID)))
	}

	return a.evaluate(accesscontrol.EvalAny(
		accesscontrol.EvalPermission(accesscontrol.ActionDashboardsRead, dashboardScope(a.dashboard.Id)),
		accesscontrol.EvalPermission(accesscontrol.ActionDashboardsRead, folderScope(a.dashboard.FolderId)),
	))
}

func (a *AccessControlDashboardGuardian) CanAdmin() (bool, error) {
	if err := a.loadDashboard(); err != nil {
		return false, err
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalAll(
			accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsRead, folderScope(a.dashboard.Id)),
			accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsWrite, folderScope(a.dashboard.Id)),
		))
	}

	return a.evaluate(accesscontrol.EvalAny(
		accesscontrol.EvalAll(
			accesscontrol.EvalPermission(accesscontrol.ActionDashboardsPermissionsRead, dashboardScope(a.dashboard.Id)),
			accesscontrol.EvalPermission(accesscontrol.ActionDashboardsPermissionsWrite, dashboardScope(a.dashboard.Id)),
		),
		accesscontrol.EvalAll(
			accesscontrol.EvalPermission(accesscontrol.ActionDashboardsPermissionsRead, folderScope(a.dashboard.FolderId)),
			accesscontrol.EvalPermission(accesscontrol.ActionDashboardsPermissionsWrite, folderScope(a.dashboard.FolderId)),
		),
	))
}

func (a *AccessControlDashboardGuardian) CanDelete() (bool, error) {
	if err := a.loadDashboard(); err != nil {
		return false, err
	}

	if a.dashboard.IsFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersDelete, folderScope(a.dashboard.Id)))
	}

	return a.evaluate(accesscontrol.EvalAny(
		accesscontrol.EvalPermission(accesscontrol.ActionDashboardsDelete, dashboardScope(a.dashboard.Id)),
		accesscontrol.EvalPermission(accesscontrol.ActionDashboardsDelete, folderScope(a.dashboard.FolderId)),
	))
}

func (a *AccessControlDashboardGuardian) CanCreate(folderID int64, isFolder bool) (bool, error) {
	if isFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersCreate))
	}

	return a.evaluate(accesscontrol.EvalPermission(accesscontrol.ActionDashboardsCreate, folderScope(folderID)))
}

func (a *AccessControlDashboardGuardian) evaluate(evaluator accesscontrol.Evaluator) (bool, error) {
	ok, err := a.ac.Evaluate(a.ctx, a.user, evaluator)
	if err != nil {
		a.log.Error("Failed to evaluate access control to folder or dashboard", "error", err, "userId", a.user.UserId, "id", a.dashboardID)
	}

	if !ok && err == nil {
		a.log.Info("Access denied to folder or dashboard", "userId", a.user.UserId, "id", a.dashboardID, "permissions", evaluator.GoString())
	}

	return ok, err
}

func (a *AccessControlDashboardGuardian) CheckPermissionBeforeUpdate(permission models.PermissionType, updatePermissions []*models.DashboardAcl) (bool, error) {
	// always true for access control
	return true, nil
}

// GetAcl translate access control permissions to dashboard acl info
func (a *AccessControlDashboardGuardian) GetAcl() ([]*models.DashboardAclInfoDTO, error) {
	if err := a.loadDashboard(); err != nil {
		return nil, err
	}

	svc := a.permissionServices.GetDashboardService()
	if a.dashboard.IsFolder {
		svc = a.permissionServices.GetFolderService()
	}

	permissions, err := svc.GetPermissions(a.ctx, a.user, strconv.FormatInt(a.dashboard.Id, 10))
	if err != nil {
		return nil, err
	}

	acl := make([]*models.DashboardAclInfoDTO, 0, len(permissions))
	for _, p := range permissions {
		if !p.IsManaged {
			continue
		}

		var role *models.RoleType
		if p.BuiltInRole != "" {
			tmp := models.RoleType(p.BuiltInRole)
			role = &tmp
		}

		acl = append(acl, &models.DashboardAclInfoDTO{
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

func (a *AccessControlDashboardGuardian) GetACLWithoutDuplicates() ([]*models.DashboardAclInfoDTO, error) {
	return a.GetAcl()
}

func (a *AccessControlDashboardGuardian) GetHiddenACL(cfg *setting.Cfg) ([]*models.DashboardAcl, error) {
	var hiddenACL []*models.DashboardAcl
	if a.user.IsGrafanaAdmin {
		return hiddenACL, nil
	}

	existingPermissions, err := a.GetAcl()
	if err != nil {
		return hiddenACL, err
	}

	for _, item := range existingPermissions {
		if item.Inherited || item.UserLogin == a.user.Login {
			continue
		}

		if _, hidden := cfg.HiddenUsers[item.UserLogin]; hidden {
			hiddenACL = append(hiddenACL, &models.DashboardAcl{
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

func (a *AccessControlDashboardGuardian) loadDashboard() error {
	if a.dashboard == nil {
		query := &models.GetDashboardQuery{Id: a.dashboardID, OrgId: a.user.OrgId}
		if err := a.store.GetDashboard(a.ctx, query); err != nil {
			return err
		}
		a.dashboard = query.Result
	}
	return nil
}

func dashboardScope(dashboardID int64) string {
	return accesscontrol.Scope("dashboards", "id", strconv.FormatInt(dashboardID, 10))
}

func folderScope(folderID int64) string {
	return dashboards.ScopeFoldersProvider.GetResourceScope(strconv.FormatInt(folderID, 10))
}
