package guardian

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
)

var _ DatasourceGuardian = new(TeamBasedGuardian)

// TeamMembership represents a user's membership in a team with their permission level
type TeamMembership struct {
	TeamID     int64
	Permission team.PermissionType
}

// TeamMembershipGetter is an interface for getting team memberships with permissions
type TeamMembershipGetter interface {
	GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool, bypassCache bool) ([]*team.TeamMemberDTO, error)
}

// TeamBasedGuardian implements team-based access control for datasources
type TeamBasedGuardian struct {
	user                identity.Requester
	orgID               int64
	dsService           datasources.DataSourceService
	teamMembershipGetter TeamMembershipGetter
}

func NewTeamBasedGuardian(user identity.Requester, orgID int64, dsService datasources.DataSourceService, teamService team.Service) *TeamBasedGuardian {
	return &TeamBasedGuardian{
		user:                user,
		orgID:               orgID,
		dsService:           dsService,
		teamMembershipGetter: teamService,
	}
}

func NewTeamBasedGuardianWithMembershipGetter(user identity.Requester, orgID int64, dsService datasources.DataSourceService, membershipGetter TeamMembershipGetter) *TeamBasedGuardian {
	return &TeamBasedGuardian{
		user:                user,
		orgID:               orgID,
		dsService:           dsService,
		teamMembershipGetter: membershipGetter,
	}
}

func (t *TeamBasedGuardian) CanQuery(datasourceID int64) (bool, error) {
	if t.user.GetIsGrafanaAdmin() {
		return true, nil
	}

	ds, err := t.dsService.GetDataSource(context.Background(), &datasources.GetDataSourceQuery{
		ID:    datasourceID,
		OrgID: t.orgID,
	})
	if err != nil {
		return false, err
	}

	if ds.AllowedTeams == "" && ds.AllowedRoles == "" {
		return true, nil
	}

	userID, err := t.user.GetInternalID()
	if err != nil {
		return false, err
	}

	memberships, err := t.teamMembershipGetter.GetUserTeamMemberships(context.Background(), t.orgID, userID, false, false)
	if err != nil {
		return false, err
	}

	userRole := t.getUserRole()
	hasTeamRestriction := ds.AllowedTeams != ""
	hasRoleRestriction := ds.AllowedRoles != ""

	if hasTeamRestriction && hasRoleRestriction {
		roleAllowed := ds.AllowedRoles == "" || ds.IsRoleAllowed(userRole)
		teamAllowed := t.checkTeamPermission(ds, memberships)
		return roleAllowed && teamAllowed, nil
	} else if hasTeamRestriction {
		return t.checkTeamPermission(ds, memberships), nil
	} else {
		return ds.IsRoleAllowed(userRole), nil
	}
}

func (t *TeamBasedGuardian) checkTeamPermission(ds *datasources.DataSource, memberships []*team.TeamMemberDTO) bool {
	rules := ds.ParseAllowedTeams()
	if len(rules) == 0 {
		return true
	}
	for _, membership := range memberships {
		for _, rule := range rules {
			if membership.TeamID == rule.TeamID {
				if membership.Permission == team.PermissionTypeAdmin && rule.Permission == datasources.TeamPermissionAdmin {
					return true
				}
				if membership.Permission == team.PermissionTypeMember && rule.Permission == datasources.TeamPermissionMember {
					return true
				}
			}
		}
	}
	return false
}

func (t *TeamBasedGuardian) FilterDatasourcesByReadPermissions(ds []*datasources.DataSource) ([]*datasources.DataSource, error) {
	return t.filterDatasourcesByPermissions(ds), nil
}

func (t *TeamBasedGuardian) FilterDatasourcesByQueryPermissions(ds []*datasources.DataSource) ([]*datasources.DataSource, error) {
	return t.filterDatasourcesByPermissions(ds), nil
}

func (t *TeamBasedGuardian) filterDatasourcesByPermissions(ds []*datasources.DataSource) []*datasources.DataSource {
	if t.user.GetIsGrafanaAdmin() {
		return ds
	}

	userID, err := t.user.GetInternalID()
	if err != nil {
		return []*datasources.DataSource{}
	}
	memberships, err := t.teamMembershipGetter.GetUserTeamMemberships(context.Background(), t.orgID, userID, false, false)
	if err != nil {
		return []*datasources.DataSource{}
	}

	userRole := t.getUserRole()

	var filtered []*datasources.DataSource
	for _, dataSource := range ds {
		if dataSource.AllowedTeams == "" && dataSource.AllowedRoles == "" {
			filtered = append(filtered, dataSource)
			continue
		}

		roleAllowed := dataSource.AllowedRoles == "" || dataSource.IsRoleAllowed(userRole)
		teamAllowed := t.checkTeamPermission(dataSource, memberships)

		hasTeamRestriction := dataSource.AllowedTeams != ""
		hasRoleRestriction := dataSource.AllowedRoles != ""

		if hasTeamRestriction && hasRoleRestriction {
			if roleAllowed && teamAllowed {
				filtered = append(filtered, dataSource)
			}
		} else if hasTeamRestriction {
			if teamAllowed {
				filtered = append(filtered, dataSource)
			}
		} else {
			if roleAllowed {
				filtered = append(filtered, dataSource)
			}
		}
	}

	return filtered
}

func (t *TeamBasedGuardian) getUserRole() string {
	// Extract role from user identity. Default to lowest permission role if uncertain.
	if t.user.GetOrgRole() == org.RoleAdmin {
		return "Admin"
	} else if t.user.GetOrgRole() == org.RoleEditor {
		return "Editor"
	}
	return "Viewer"
}