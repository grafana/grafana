package accesscontrol

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util"
)

func AddTeamMembershipMigrations(mg *migrator.Migrator) {
	mg.AddMigration("teams permissions migration", &teamPermissionMigrator{editorsCanAdmin: mg.Cfg.EditorsCanAdmin})
}

var _ migrator.CodeMigration = new(teamPermissionMigrator)

type teamPermissionMigrator struct {
	migrator.MigrationBase
	editorsCanAdmin bool
}

func (p *teamPermissionMigrator) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (p *teamPermissionMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	return p.migrateMemberships(sess)
}

func generateNewRoleUID(sess *xorm.Session, orgID int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Where("org_id=? AND uid=?", orgID, uid).Get(&accesscontrol.Role{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", fmt.Errorf("failed to generate uid")
}

func (p *teamPermissionMigrator) findRole(sess *xorm.Session, orgID, userID int64, name string) (int64, error) {
	// check if role exists
	var id int64
	_, err := sess.Table("role").Select("id").Where("org_id = ? AND name = ?", orgID, name).Get(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

// TODO cut into chunks
func (p *teamPermissionMigrator) bulkCreateRoles(sess *xorm.Session, roles []accesscontrol.Role) ([]accesscontrol.Role, error) {
	ts := time.Now()
	// bulk role creations
	valueStrings := make([]string, len(roles))
	args := make([]interface{}, 0, len(roles)*5)

	for i, r := range roles {
		uid, err := generateNewRoleUID(sess, r.OrgID)
		if err != nil {
			return nil, err
		}
		valueStrings[i] = "(?, ?, ?, ?, ?)"
		args = append(args, r.OrgID, uid, r.Name, ts, ts)
	}

	valueString := strings.Join(valueStrings, ",")
	sql := fmt.Sprintf("INSERT INTO role (org_id, uid, name, created, updated) VALUES %s RETURNING id, org_id, name", valueString)

	createdRoles := make([]accesscontrol.Role, len(roles))
	err := sess.SQL(sql, args...).Find(&createdRoles)

	return createdRoles, err
}

// TODO cut into chunks
// TODO use orgID-roleName as key
func (p *teamPermissionMigrator) bulkAssignRoles(sess *xorm.Session, rolesMap map[string]*accesscontrol.Role, assignments map[int64][]string) error {
	ts := time.Now()

	roleAssignments := make([]accesscontrol.UserRole, len(assignments))
	for userID, roleNames := range assignments {
		for _, roleName := range roleNames {
			roleToAssign, ok := rolesMap[roleName]
			if !ok {
				return fmt.Errorf("Sorry")
			}
			roleAssignments = append(roleAssignments, accesscontrol.UserRole{
				OrgID:   roleToAssign.OrgID,
				RoleID:  roleToAssign.ID,
				UserID:  userID,
				Created: ts,
			})
		}
	}

	_, err := sess.Table("user_role").InsertMulti(roleAssignments)
	return err
}

// setRolePermissions sets the role permissions deleting any team related ones before inserting any.
func (p *teamPermissionMigrator) setRolePermissions(sess *xorm.Session, roleID int64, permissions []accesscontrol.Permission) error {
	// First drop existing permissions
	if _, errDeletingPerms := sess.SQL("DELETE FROM permission WHERE role_id = ? AND action LIKE ?", roleID, "teams:%").Exec(); errDeletingPerms != nil {
		return errDeletingPerms
	}

	// Then insert new permissions
	var newPermissions []accesscontrol.Permission
	now := time.Now()
	for _, permission := range permissions {
		permission.RoleID = roleID
		permission.Created = now
		permission.Updated = now
		newPermissions = append(newPermissions, permission)
	}

	if _, errInsertPerms := sess.InsertMulti(&newPermissions); errInsertPerms != nil {
		return errInsertPerms
	}

	return nil
}

// mapPermissionToFGAC translates the legacy membership (Member or Admin) into FGAC permissions
func (p *teamPermissionMigrator) mapPermissionToFGAC(permission models.PermissionType, teamID int64) []accesscontrol.Permission {
	teamIDScope := accesscontrol.Scope("teams", "id", strconv.FormatInt(teamID, 10))
	switch permission {
	case 0:
		return []accesscontrol.Permission{{Action: "teams:read", Scope: teamIDScope}}
	case models.PERMISSION_ADMIN:
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

func (p *teamPermissionMigrator) getUserRoleByOrgMapping(sess *xorm.Session) (map[int64]map[int64]string, error) {
	var orgUsers []*models.OrgUserDTO
	if err := sess.SQL(`SELECT * FROM org_user`).Cols("org_user.org_id", "org_user.user_id", "org_user.role").Find(&orgUsers); err != nil {
		return nil, err
	}

	userRolesByOrg := map[int64]map[int64]string{}

	// Loop through users and organise them by organization ID
	for _, orgUser := range orgUsers {
		orgRoles, initialized := userRolesByOrg[orgUser.OrgId]
		if !initialized {
			orgRoles = map[int64]string{}
		}

		orgRoles[orgUser.UserId] = orgUser.Role
		userRolesByOrg[orgUser.OrgId] = orgRoles
	}

	return userRolesByOrg, nil
}

// migrateMemberships generate managed permissions for users based on their memberships to teams
func (p *teamPermissionMigrator) migrateMemberships(sess *xorm.Session) error {
	userRolesByOrg, err := p.getUserRoleByOrgMapping(sess)
	if err != nil {
		return err
	}

	var teamMemberships []models.TeamMember
	if err := sess.SQL(`SELECT * FROM team_member`).Find(&teamMemberships); err != nil {
		return err
	}

	userPermissionsByOrg := map[int64]map[int64][]accesscontrol.Permission{}

	// Loop through memberships and generate associated permissions
	for _, m := range teamMemberships {
		// Downgrade team permissions if needed - only organisation admins or organisation editors (when editorsCanAdmin feature is enabled)
		// can access team administration endpoints
		if m.Permission == models.PERMISSION_ADMIN {
			if userRolesByOrg[m.OrgId][m.UserId] == string(models.ROLE_VIEWER) || (userRolesByOrg[m.OrgId][m.UserId] == string(models.ROLE_EDITOR) && !p.editorsCanAdmin) {
				m.Permission = 0
				// log?
				_, err := sess.Cols("permission").Where("org_id=? and team_id=? and user_id=?", m.OrgId, m.TeamId, m.UserId).Update(m)
				if err != nil {
					return err
				}
			}
		}

		userPermissions, initialized := userPermissionsByOrg[m.OrgId]
		if !initialized {
			userPermissions = map[int64][]accesscontrol.Permission{}
		}
		userPermissions[m.UserId] = append(userPermissions[m.UserId], p.mapPermissionToFGAC(m.Permission, m.TeamId)...)
		userPermissionsByOrg[m.OrgId] = userPermissions
	}

	// Create a map of roles to create
	var rolesToCreate []accesscontrol.Role
	var assignments map[int64][]string
	// TODO use orgID-roleName as key
	rolesMap := make(map[string]*accesscontrol.Role)
	for orgID, userPermissions := range userPermissionsByOrg {
		for userID := range userPermissions {
			roleName := fmt.Sprintf("managed:users:%d:permissions", userID)
			roleID, errFindingRoles := p.findRole(sess, orgID, userID, roleName)
			if errFindingRoles != nil {
				return errFindingRoles
			}
			if roleID == 0 {
				rolesToCreate = append(rolesToCreate, accesscontrol.Role{
					Name:  roleName,
					OrgID: orgID,
				})
				userAssignments := assignments[userID]
				userAssignments = append(userAssignments, roleName)
				assignments[userID] = userAssignments

			}
			// TODO populate rolesMap with existing role
		}
	}

	// Create missing roles
	createdRoles, errCreate := p.bulkCreateRoles(sess, rolesToCreate)
	if errCreate != nil {
		return errCreate
	}

	// Populate rolesMap with the newly created roles
	for i := range createdRoles {
		rolesMap[createdRoles[i].Name] = &createdRoles[i]
	}

	// Assign missing roles
	errAssign := p.bulkAssignRoles(sess, rolesMap, assignments)
	if errAssign != nil {
		return errAssign
	}

	// Set roles permissions
	for _, userPermissions := range userPermissionsByOrg {
		for userID, permissions := range userPermissions {
			roleName := fmt.Sprintf("managed:users:%d:permissions", userID)

			role, ok := rolesMap[roleName]
			if !ok {
				return fmt.Errorf("Sorry")
			}

			if errSettingPerms := p.setRolePermissions(sess, role.ID, permissions); errSettingPerms != nil {
				return errSettingPerms
			}
		}
	}

	return nil
}
