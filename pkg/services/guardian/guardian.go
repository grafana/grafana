package guardian

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrGuardianPermissionExists = errors.New("Permission already exists")
	ErrGuardianOverride         = errors.New("You can only override a permission to be higher")
)

// DashboardGuardian to be used for guard against operations without access on dashboard and acl
type DashboardGuardian interface {
	CanSave() (bool, error)
	CanEdit() (bool, error)
	CanView() (bool, error)
	CanAdmin() (bool, error)
	HasPermission(permission m.PermissionType) (bool, error)
	CheckPermissionBeforeUpdate(permission m.PermissionType, updatePermissions []*m.DashboardAcl) (bool, error)
	GetAcl() ([]*m.DashboardAclInfoDTO, error)
}

type dashboardGuardianImpl struct {
	user   *m.SignedInUser
	dashId int64
	orgId  int64
	acl    []*m.DashboardAclInfoDTO
	teams  []*m.TeamDTO
	log    log.Logger
}

// New factory for creating a new dashboard guardian instance
var New = func(dashId int64, orgId int64, user *m.SignedInUser) DashboardGuardian {
	return &dashboardGuardianImpl{
		user:   user,
		dashId: dashId,
		orgId:  orgId,
		log:    log.New("guardians.dashboard"),
	}
}

func (g *dashboardGuardianImpl) CanSave() (bool, error) {
	return g.HasPermission(m.PERMISSION_EDIT)
}

func (g *dashboardGuardianImpl) CanEdit() (bool, error) {
	if setting.ViewersCanEdit {
		return g.HasPermission(m.PERMISSION_VIEW)
	}

	return g.HasPermission(m.PERMISSION_EDIT)
}

func (g *dashboardGuardianImpl) CanView() (bool, error) {
	return g.HasPermission(m.PERMISSION_VIEW)
}

func (g *dashboardGuardianImpl) CanAdmin() (bool, error) {
	return g.HasPermission(m.PERMISSION_ADMIN)
}

func (g *dashboardGuardianImpl) HasPermission(permission m.PermissionType) (bool, error) {
	if g.user.OrgRole == m.ROLE_ADMIN {
		return true, nil
	}

	acl, err := g.GetAcl()
	if err != nil {
		return false, err
	}

	return g.checkAcl(permission, acl)
}

func (g *dashboardGuardianImpl) checkAcl(permission m.PermissionType, acl []*m.DashboardAclInfoDTO) (bool, error) {
	orgRole := g.user.OrgRole
	teamAclItems := []*m.DashboardAclInfoDTO{}

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
			teamAclItems = append(teamAclItems, p)
		}
	}

	// do we have team rules?
	if len(teamAclItems) == 0 {
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

func (g *dashboardGuardianImpl) CheckPermissionBeforeUpdate(permission m.PermissionType, updatePermissions []*m.DashboardAcl) (bool, error) {
	acl := []*m.DashboardAclInfoDTO{}
	adminRole := m.ROLE_ADMIN
	everyoneWithAdminRole := &m.DashboardAclInfoDTO{DashboardId: g.dashId, UserId: 0, TeamId: 0, Role: &adminRole, Permission: m.PERMISSION_ADMIN}

	// validate that duplicate permissions don't exists
	for _, p := range updatePermissions {
		aclItem := &m.DashboardAclInfoDTO{DashboardId: p.DashboardId, UserId: p.UserId, TeamId: p.TeamId, Role: p.Role, Permission: p.Permission}
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

	existingPermissions, err := g.GetAcl()
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

	if g.user.OrgRole == m.ROLE_ADMIN {
		return true, nil
	}

	return g.checkAcl(permission, existingPermissions)
}

// GetAcl returns dashboard acl
func (g *dashboardGuardianImpl) GetAcl() ([]*m.DashboardAclInfoDTO, error) {
	if g.acl != nil {
		return g.acl, nil
	}

	query := m.GetDashboardAclInfoListQuery{DashboardId: g.dashId, OrgId: g.orgId}
	if err := bus.Dispatch(&query); err != nil {
		return nil, err
	}

	g.acl = query.Result
	return g.acl, nil
}

func (g *dashboardGuardianImpl) getTeams() ([]*m.TeamDTO, error) {
	if g.teams != nil {
		return g.teams, nil
	}

	query := m.GetTeamsByUserQuery{OrgId: g.orgId, UserId: g.user.UserId}
	err := bus.Dispatch(&query)

	g.teams = query.Result
	return query.Result, err
}

type FakeDashboardGuardian struct {
	DashId                           int64
	OrgId                            int64
	User                             *m.SignedInUser
	CanSaveValue                     bool
	CanEditValue                     bool
	CanViewValue                     bool
	CanAdminValue                    bool
	HasPermissionValue               bool
	CheckPermissionBeforeUpdateValue bool
	CheckPermissionBeforeUpdateError error
	GetAclValue                      []*m.DashboardAclInfoDTO
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

func (g *FakeDashboardGuardian) HasPermission(permission m.PermissionType) (bool, error) {
	return g.HasPermissionValue, nil
}

func (g *FakeDashboardGuardian) CheckPermissionBeforeUpdate(permission m.PermissionType, updatePermissions []*m.DashboardAcl) (bool, error) {
	return g.CheckPermissionBeforeUpdateValue, g.CheckPermissionBeforeUpdateError
}

func (g *FakeDashboardGuardian) GetAcl() ([]*m.DashboardAclInfoDTO, error) {
	return g.GetAclValue, nil
}

func MockDashboardGuardian(mock *FakeDashboardGuardian) {
	New = func(dashId int64, orgId int64, user *m.SignedInUser) DashboardGuardian {
		mock.OrgId = orgId
		mock.DashId = dashId
		mock.User = user
		return mock
	}
}
