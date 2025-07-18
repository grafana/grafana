package accesscontrol

import (
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/team"
)

const (
	TeamsMigrationID = "teams permissions migration"
)

func AddTeamMembershipMigrations(mg *migrator.Migrator) {
	mg.AddMigration(TeamsMigrationID, &teamPermissionMigrator{})
}

var _ migrator.CodeMigration = new(teamPermissionMigrator)

type teamPermissionMigrator struct {
	permissionMigrator
}

func (p *teamPermissionMigrator) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (p *teamPermissionMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	p.sess = sess
	p.dialect = migrator.Dialect
	return p.migrateMemberships()
}

// setRolePermissions sets the role permissions deleting any team related ones before inserting any.
func (p *teamPermissionMigrator) setRolePermissions(roleID int64, permissions []accesscontrol.Permission) error {
	// First drop existing permissions
	if _, errDeletingPerms := p.sess.Exec("DELETE FROM permission WHERE role_id = ? AND (action LIKE ? OR action LIKE ?)", roleID, "teams:%", "teams.permissions:%"); errDeletingPerms != nil {
		return errDeletingPerms
	}

	// Then insert new permissions
	newPermissions := make([]accesscontrol.Permission, 0, len(permissions))
	now := time.Now()
	for _, permission := range permissions {
		permission.RoleID = roleID
		permission.Created = now
		permission.Updated = now
		newPermissions = append(newPermissions, permission)
	}

	if _, errInsertPerms := p.sess.InsertMulti(&newPermissions); errInsertPerms != nil {
		return errInsertPerms
	}

	return nil
}

// mapPermissionToRBAC translates the legacy membership (Member or Admin) into RBAC permissions
func (p *teamPermissionMigrator) mapPermissionToRBAC(permission team.PermissionType, teamID int64) []accesscontrol.Permission {
	teamIDScope := accesscontrol.Scope("teams", "id", strconv.FormatInt(teamID, 10))
	switch permission {
	case team.PermissionTypeMember:
		return []accesscontrol.Permission{{Action: "teams:read", Scope: teamIDScope}}
	case team.PermissionTypeAdmin:
		return []accesscontrol.Permission{
			{Action: "teams:delete", Scope: teamIDScope},
			{Action: "teams:read", Scope: teamIDScope},
			{Action: "teams:write", Scope: teamIDScope},
			{Action: "teams.permissions:read", Scope: teamIDScope},
			{Action: "teams.permissions:write", Scope: teamIDScope},
		}
	default:
		return []accesscontrol.Permission{}
	}
}

func (p *teamPermissionMigrator) getUserRoleByOrgMapping() (map[int64]map[int64]string, error) {
	var orgUsers []*org.OrgUserDTO
	if err := p.sess.SQL(`SELECT * FROM org_user`).Cols("org_user.org_id", "org_user.user_id", "org_user.role").Find(&orgUsers); err != nil {
		return nil, err
	}

	userRolesByOrg := map[int64]map[int64]string{}

	// Loop through users and organise them by organization ID
	for _, orgUser := range orgUsers {
		orgRoles, initialized := userRolesByOrg[orgUser.OrgID]
		if !initialized {
			orgRoles = map[int64]string{}
		}

		orgRoles[orgUser.UserID] = orgUser.Role
		userRolesByOrg[orgUser.OrgID] = orgRoles
	}

	return userRolesByOrg, nil
}

// migrateMemberships generate managed permissions for users based on their memberships to teams
func (p *teamPermissionMigrator) migrateMemberships() error {
	// Fetch user roles in each org
	userRolesByOrg, err := p.getUserRoleByOrgMapping()
	if err != nil {
		return err
	}

	// Fetch team memberships
	teamMemberships := []*team.TeamMember{}
	if err := p.sess.SQL("SELECT * FROM team_member").Find(&teamMemberships); err != nil {
		return err
	}

	// No need to create any roles if there is no team members
	if len(teamMemberships) == 0 {
		return nil
	}

	// Loop through memberships and generate associated permissions
	// Downgrade team permissions if needed - only admins or editors (when editorsCanAdmin option is enabled)
	// can access team administration endpoints
	userPermissionsByOrg, errGen := p.generateAssociatedPermissions(teamMemberships, userRolesByOrg)
	if errGen != nil {
		return errGen
	}

	// Sort roles that:
	// * need to be created and assigned (rolesToCreate)
	// * are already created and assigned (rolesByOrg)
	rolesToCreate, rolesByOrg, errOrganizeRoles := p.sortRolesToAssign(userPermissionsByOrg)
	if errOrganizeRoles != nil {
		return errOrganizeRoles
	}

	// Create missing roles
	createdRoles, errCreate := p.bulkCreateRoles(rolesToCreate)
	if errCreate != nil {
		return errCreate
	}

	// Populate rolesMap with the newly created roles
	for i := range createdRoles {
		rolesByOrg[createdRoles[i].OrgID][createdRoles[i].Name] = createdRoles[i]
	}

	// Assign newly created roles
	if errAssign := p.bulkAssignRoles(createdRoles); errAssign != nil {
		return errAssign
	}

	// Set all roles teams related permissions
	return p.setRolePermissionsForOrgs(userPermissionsByOrg, rolesByOrg)
}

func (p *teamPermissionMigrator) setRolePermissionsForOrgs(userPermissionsByOrg map[int64]map[int64][]accesscontrol.Permission, rolesByOrg map[int64]map[string]*accesscontrol.Role) error {
	for orgID, userPermissions := range userPermissionsByOrg {
		for userID, permissions := range userPermissions {
			role, ok := rolesByOrg[orgID][fmt.Sprintf("managed:users:%d:permissions", userID)]
			if !ok {
				return &ErrUnknownRole{fmt.Sprintf("managed:users:%d:permissions", userID)}
			}

			if errSettingPerms := p.setRolePermissions(role.ID, permissions); errSettingPerms != nil {
				return errSettingPerms
			}
		}
	}
	return nil
}

func (p *teamPermissionMigrator) sortRolesToAssign(userPermissionsByOrg map[int64]map[int64][]accesscontrol.Permission) ([]*accesscontrol.Role, map[int64]map[string]*accesscontrol.Role, error) {
	var rolesToCreate []*accesscontrol.Role

	rolesByOrg := map[int64]map[string]*accesscontrol.Role{}
	for orgID, userPermissions := range userPermissionsByOrg {
		for userID := range userPermissions {
			roleName := fmt.Sprintf("managed:users:%d:permissions", userID)
			role, errFindingRoles := p.findRole(orgID, roleName)
			if errFindingRoles != nil {
				return nil, nil, errFindingRoles
			}

			if rolesByOrg[orgID] == nil {
				rolesByOrg[orgID] = map[string]*accesscontrol.Role{}
			}

			if role.ID != 0 {
				rolesByOrg[orgID][roleName] = &role
			} else {
				rolesToCreate = append(rolesToCreate, &accesscontrol.Role{Name: roleName, OrgID: orgID})
			}
		}
	}

	return rolesToCreate, rolesByOrg, nil
}

func (p *teamPermissionMigrator) generateAssociatedPermissions(teamMemberships []*team.TeamMember,
	userRolesByOrg map[int64]map[int64]string) (map[int64]map[int64][]accesscontrol.Permission, error) {
	userPermissionsByOrg := map[int64]map[int64][]accesscontrol.Permission{}

	for _, m := range teamMemberships {
		// Downgrade team permissions if needed:
		// only admins or editors (when editorsCanAdmin option is enabled)
		// can access team administration endpoints
		if m.Permission == team.PermissionTypeAdmin {
			if userRolesByOrg[m.OrgID][m.UserID] == string(org.RoleViewer) || (userRolesByOrg[m.OrgID][m.UserID] == string(org.RoleEditor)) {
				m.Permission = 0

				if _, err := p.sess.Cols("permission").Where("org_id=? and team_id=? and user_id=?", m.OrgID, m.TeamID, m.UserID).Update(m); err != nil {
					return nil, err
				}
			}
		}

		userPermissions, initialized := userPermissionsByOrg[m.OrgID]
		if !initialized {
			userPermissions = map[int64][]accesscontrol.Permission{}
		}
		userPermissions[m.UserID] = append(userPermissions[m.UserID], p.mapPermissionToRBAC(m.Permission, m.TeamID)...)
		userPermissionsByOrg[m.OrgID] = userPermissions
	}

	return userPermissionsByOrg, nil
}
