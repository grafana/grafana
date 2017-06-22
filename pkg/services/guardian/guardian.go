package guardian

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

type DashboardGuardian struct {
	user   *m.SignedInUser
	dashId int64
	orgId  int64
	acl    []*m.DashboardAclInfoDTO
	groups []*m.UserGroup
	log    log.Logger
}

func NewDashboardGuardian(dashId int64, orgId int64, user *m.SignedInUser) *DashboardGuardian {
	return &DashboardGuardian{
		user:   user,
		dashId: dashId,
		orgId:  orgId,
		log:    log.New("guardians.dashboard"),
	}
}

func (g *DashboardGuardian) CanSave() (bool, error) {
	return g.HasPermission(m.PERMISSION_EDIT)
}

func (g *DashboardGuardian) CanEdit() (bool, error) {
	return g.HasPermission(m.PERMISSION_EDIT)
}

func (g *DashboardGuardian) CanView() (bool, error) {
	return g.HasPermission(m.PERMISSION_VIEW)
}

func (g *DashboardGuardian) CanAdmin() (bool, error) {
	return g.HasPermission(m.PERMISSION_ADMIN)
}

func (g *DashboardGuardian) HasPermission(permission m.PermissionType) (bool, error) {
	if g.user.OrgRole == m.ROLE_ADMIN {
		return true, nil
	}

	acl, err := g.GetAcl()
	if err != nil {
		return false, err
	}

	userGroups, err := g.getUserGroups()
	if err != nil {
		return false, err
	}

	for _, p := range acl {
		if p.UserId == g.user.UserId && p.Permission >= permission {
			return true, nil
		}

		for _, ug := range userGroups {
			if ug.Id == p.UserGroupId && p.Permission >= permission {
				return true, nil
			}
		}

		if p.Role != nil {
			if *p.Role == g.user.OrgRole && p.Permission >= permission {
				return true, nil
			}
		}
	}

	return false, nil
}

// Returns dashboard acl
func (g *DashboardGuardian) GetAcl() ([]*m.DashboardAclInfoDTO, error) {
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

func (g *DashboardGuardian) getUserGroups() ([]*m.UserGroup, error) {
	if g.groups != nil {
		return g.groups, nil
	}

	query := m.GetUserGroupsByUserQuery{UserId: g.user.UserId}
	err := bus.Dispatch(&query)

	g.groups = query.Result
	return query.Result, err
}
