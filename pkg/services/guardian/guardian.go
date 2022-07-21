package guardian

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrGuardianPermissionExists = errors.New("permission already exists")
	ErrGuardianOverride         = errors.New("you can only override a permission to be higher")
)

// DashboardGuardian to be used for guard against operations without access on dashboard and acl
type DashboardGuardian interface {
	CanSave() (bool, error)
	CanEdit() (bool, error)
	CanView() (bool, error)
	CanAdmin() (bool, error)
	CanDelete() (bool, error)
	CanCreate(folderID int64, isFolder bool) (bool, error)
	CheckPermissionBeforeUpdate(permission models.PermissionType, updatePermissions []*models.DashboardACL) (bool, error)

	// GetACL returns ACL.
	GetACL() ([]*models.DashboardACLInfoDTO, error)

	// GetACLWithoutDuplicates returns ACL and strips any permission
	// that already has an inherited permission with higher or equal
	// permission.
	GetACLWithoutDuplicates() ([]*models.DashboardACLInfoDTO, error)
	GetHiddenACL(*setting.Cfg) ([]*models.DashboardACL, error)
}

type dashboardGuardianImpl struct {
	user             *models.SignedInUser
	dashId           int64
	orgId            int64
	acl              []*models.DashboardACLInfoDTO
	teams            []*models.TeamDTO
	log              log.Logger
	ctx              context.Context
	store            sqlstore.Store
	dashboardService dashboards.DashboardService
}

// New factory for creating a new dashboard guardian instance
// When using access control this function is replaced on startup and the AccessControlDashboardGuardian is returned
var New = func(ctx context.Context, dashId int64, orgId int64, user *models.SignedInUser) DashboardGuardian {
	panic("no guardian factory implementation provided")
}

func newDashboardGuardian(ctx context.Context, dashId int64, orgId int64, user *models.SignedInUser, store sqlstore.Store, dashSvc dashboards.DashboardService) *dashboardGuardianImpl {
	return &dashboardGuardianImpl{
		user:             user,
		dashId:           dashId,
		orgId:            orgId,
		log:              log.New("dashboard.permissions"),
		ctx:              ctx,
		store:            store,
		dashboardService: dashSvc,
	}
}

func (g *dashboardGuardianImpl) CanSave() (bool, error) {
	return g.HasPermission(models.PERMISSION_EDIT)
}

func (g *dashboardGuardianImpl) CanEdit() (bool, error) {
	if setting.ViewersCanEdit {
		return g.HasPermission(models.PERMISSION_VIEW)
	}

	return g.HasPermission(models.PERMISSION_EDIT)
}

func (g *dashboardGuardianImpl) CanView() (bool, error) {
	return g.HasPermission(models.PERMISSION_VIEW)
}

func (g *dashboardGuardianImpl) CanAdmin() (bool, error) {
	return g.HasPermission(models.PERMISSION_ADMIN)
}

func (g *dashboardGuardianImpl) CanDelete() (bool, error) {
	// when using dashboard guardian without access control a user can delete a dashboard if they can save it
	return g.CanSave()
}

func (g *dashboardGuardianImpl) CanCreate(_ int64, _ bool) (bool, error) {
	// when using dashboard guardian without access control a user can create a dashboard if they can save it
	return g.CanSave()
}

func (g *dashboardGuardianImpl) HasPermission(permission models.PermissionType) (bool, error) {
	if g.user.OrgRole == models.ROLE_ADMIN {
		return g.logHasPermissionResult(permission, true, nil)
	}

	acl, err := g.GetACL()
	if err != nil {
		return g.logHasPermissionResult(permission, false, err)
	}

	result, err := g.checkACL(permission, acl)
	return g.logHasPermissionResult(permission, result, err)
}

func (g *dashboardGuardianImpl) logHasPermissionResult(permission models.PermissionType, hasPermission bool, err error) (bool, error) {
	if err != nil {
		return hasPermission, err
	}

	if hasPermission {
		g.log.Debug("User granted access to execute action", "userId", g.user.UserId, "orgId", g.orgId, "uname", g.user.Login, "dashId", g.dashId, "action", permission)
	} else {
		g.log.Debug("User denied access to execute action", "userId", g.user.UserId, "orgId", g.orgId, "uname", g.user.Login, "dashId", g.dashId, "action", permission)
	}

	return hasPermission, err
}

func (g *dashboardGuardianImpl) checkACL(permission models.PermissionType, acl []*models.DashboardACLInfoDTO) (bool, error) {
	orgRole := g.user.OrgRole
	teamACLItems := []*models.DashboardACLInfoDTO{}

	for _, p := range acl {
		// user match
		if !g.user.IsAnonymous && p.UserId > 0 {
			if p.UserId == g.user.UserId && p.Permission >= permission {
				return true, nil
			}
		}

		// role match
		if p.Role != nil {
			if *p.Role == orgRole && p.Permission >= permission {
				return true, nil
			}
		}

		// remember this rule for later
		if p.TeamId > 0 {
			teamACLItems = append(teamACLItems, p)
		}
	}

	// do we have team rules?
	if len(teamACLItems) == 0 {
		return false, nil
	}

	// load teams
	teams, err := g.getTeams()
	if err != nil {
		return false, err
	}

	// evaluate team rules
	for _, p := range acl {
		for _, ug := range teams {
			if ug.Id == p.TeamId && p.Permission >= permission {
				return true, nil
			}
		}
	}

	return false, nil
}

func (g *dashboardGuardianImpl) CheckPermissionBeforeUpdate(permission models.PermissionType, updatePermissions []*models.DashboardACL) (bool, error) {
	acl := []*models.DashboardACLInfoDTO{}
	adminRole := models.ROLE_ADMIN
	everyoneWithAdminRole := &models.DashboardACLInfoDTO{DashboardId: g.dashId, UserId: 0, TeamId: 0, Role: &adminRole, Permission: models.PERMISSION_ADMIN}

	// validate that duplicate permissions don't exists
	for _, p := range updatePermissions {
		aclItem := &models.DashboardACLInfoDTO{DashboardId: p.DashboardID, UserId: p.UserID, TeamId: p.TeamID, Role: p.Role, Permission: p.Permission}
		if aclItem.IsDuplicateOf(everyoneWithAdminRole) {
			return false, ErrGuardianPermissionExists
		}

		for _, a := range acl {
			if a.IsDuplicateOf(aclItem) {
				return false, ErrGuardianPermissionExists
			}
		}

		acl = append(acl, aclItem)
	}

	existingPermissions, err := g.GetACL()
	if err != nil {
		return false, err
	}

	// validate overridden permissions to be higher
	for _, a := range acl {
		for _, existingPerm := range existingPermissions {
			if !existingPerm.Inherited {
				continue
			}

			if a.IsDuplicateOf(existingPerm) && a.Permission <= existingPerm.Permission {
				return false, ErrGuardianOverride
			}
		}
	}

	if g.user.OrgRole == models.ROLE_ADMIN {
		return true, nil
	}

	return g.checkACL(permission, existingPermissions)
}

// GetACL returns dashboard acl
func (g *dashboardGuardianImpl) GetACL() ([]*models.DashboardACLInfoDTO, error) {
	if g.acl != nil {
		return g.acl, nil
	}

	query := models.GetDashboardACLInfoListQuery{DashboardID: g.dashId, OrgID: g.orgId}
	if err := g.dashboardService.GetDashboardACLInfoList(g.ctx, &query); err != nil {
		return nil, err
	}
	g.acl = query.Result
	return g.acl, nil
}

func (g *dashboardGuardianImpl) GetACLWithoutDuplicates() ([]*models.DashboardACLInfoDTO, error) {
	acl, err := g.GetACL()
	if err != nil {
		return nil, err
	}

	nonInherited := []*models.DashboardACLInfoDTO{}
	inherited := []*models.DashboardACLInfoDTO{}
	for _, aclItem := range acl {
		if aclItem.Inherited {
			inherited = append(inherited, aclItem)
		} else {
			nonInherited = append(nonInherited, aclItem)
		}
	}

	result := []*models.DashboardACLInfoDTO{}
	for _, nonInheritedACLItem := range nonInherited {
		duplicate := false
		for _, inheritedACLItem := range inherited {
			if nonInheritedACLItem.IsDuplicateOf(inheritedACLItem) && nonInheritedACLItem.Permission <= inheritedACLItem.Permission {
				duplicate = true
				break
			}
		}

		if !duplicate {
			result = append(result, nonInheritedACLItem)
		}
	}

	result = append(inherited, result...)

	return result, nil
}

func (g *dashboardGuardianImpl) getTeams() ([]*models.TeamDTO, error) {
	if g.teams != nil {
		return g.teams, nil
	}

	query := models.GetTeamsByUserQuery{OrgId: g.orgId, UserId: g.user.UserId, SignedInUser: g.user}
	err := g.store.GetTeamsByUser(g.ctx, &query)

	g.teams = query.Result
	return query.Result, err
}

func (g *dashboardGuardianImpl) GetHiddenACL(cfg *setting.Cfg) ([]*models.DashboardACL, error) {
	hiddenACL := make([]*models.DashboardACL, 0)
	if g.user.IsGrafanaAdmin {
		return hiddenACL, nil
	}

	existingPermissions, err := g.GetACL()
	if err != nil {
		return hiddenACL, err
	}

	for _, item := range existingPermissions {
		if item.Inherited || item.UserLogin == g.user.Login {
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

// nolint:unused
type FakeDashboardGuardian struct {
	DashId                           int64
	OrgId                            int64
	User                             *models.SignedInUser
	CanSaveValue                     bool
	CanEditValue                     bool
	CanViewValue                     bool
	CanAdminValue                    bool
	HasPermissionValue               bool
	CheckPermissionBeforeUpdateValue bool
	CheckPermissionBeforeUpdateError error
	GetACLValue                      []*models.DashboardACLInfoDTO
	GetHiddenACLValue                []*models.DashboardACL
}

func (g *FakeDashboardGuardian) CanSave() (bool, error) {
	return g.CanSaveValue, nil
}

func (g *FakeDashboardGuardian) CanEdit() (bool, error) {
	return g.CanEditValue, nil
}

func (g *FakeDashboardGuardian) CanView() (bool, error) {
	return g.CanViewValue, nil
}

func (g *FakeDashboardGuardian) CanAdmin() (bool, error) {
	return g.CanAdminValue, nil
}

func (g *FakeDashboardGuardian) CanDelete() (bool, error) {
	return g.CanSaveValue, nil
}

func (g *FakeDashboardGuardian) CanCreate(_ int64, _ bool) (bool, error) {
	return g.CanSaveValue, nil
}

func (g *FakeDashboardGuardian) HasPermission(permission models.PermissionType) (bool, error) {
	return g.HasPermissionValue, nil
}

func (g *FakeDashboardGuardian) CheckPermissionBeforeUpdate(permission models.PermissionType, updatePermissions []*models.DashboardACL) (bool, error) {
	return g.CheckPermissionBeforeUpdateValue, g.CheckPermissionBeforeUpdateError
}

func (g *FakeDashboardGuardian) GetACL() ([]*models.DashboardACLInfoDTO, error) {
	return g.GetACLValue, nil
}

func (g *FakeDashboardGuardian) GetACLWithoutDuplicates() ([]*models.DashboardACLInfoDTO, error) {
	return g.GetACL()
}

func (g *FakeDashboardGuardian) GetHiddenACL(cfg *setting.Cfg) ([]*models.DashboardACL, error) {
	return g.GetHiddenACLValue, nil
}

// nolint:unused
func MockDashboardGuardian(mock *FakeDashboardGuardian) {
	New = func(_ context.Context, dashId int64, orgId int64, user *models.SignedInUser) DashboardGuardian {
		mock.OrgId = orgId
		mock.DashId = dashId
		mock.User = user
		return mock
	}
}
