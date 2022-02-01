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

const (
	TeamsMigrationID = "teams permissions migration"
	batchSize        = 500
)

func AddTeamMembershipMigrations(mg *migrator.Migrator) {
	mg.AddMigration(TeamsMigrationID, &teamPermissionMigrator{editorsCanAdmin: mg.Cfg.EditorsCanAdmin})
}

var _ migrator.CodeMigration = new(teamPermissionMigrator)

type teamPermissionMigrator struct {
	migrator.MigrationBase
	editorsCanAdmin bool
	sess            *xorm.Session
	dialect         migrator.Dialect
}

func (p *teamPermissionMigrator) getAssignmentKey(orgID int64, name string) string {
	return fmt.Sprint(orgID, "-", name)
}

func (p *teamPermissionMigrator) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (p *teamPermissionMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	p.sess = sess
	p.dialect = migrator.Dialect
	return p.migrateMemberships()
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

func (p *teamPermissionMigrator) findRole(orgID int64, name string) (accesscontrol.Role, error) {
	// check if role exists
	var role accesscontrol.Role
	_, err := p.sess.Table("role").Where("org_id = ? AND name = ?", orgID, name).Get(&role)
	return role, err
}

func batch(count, batchSize int, eachFn func(start, end int) error) error {
	for i := 0; i < count; {
		end := i + batchSize
		if end > count {
			end = count
		}

		if err := eachFn(i, end); err != nil {
			return err
		}

		i = end
	}

	return nil
}

func (p *teamPermissionMigrator) bulkCreateRoles(allRoles []*accesscontrol.Role) ([]*accesscontrol.Role, error) {
	if len(allRoles) == 0 {
		return nil, nil
	}

	allCreatedRoles := make([]*accesscontrol.Role, 0, len(allRoles))

	createRoles := p.createRoles
	if p.dialect.DriverName() == migrator.MySQL {
		createRoles = p.createRolesMySQL
	}

	// bulk role creations
	err := batch(len(allRoles), batchSize, func(start, end int) error {
		roles := allRoles[start:end]
		createdRoles, err := createRoles(roles, start, end)
		if err != nil {
			return err
		}
		allCreatedRoles = append(allCreatedRoles, createdRoles...)
		return nil
	})

	return allCreatedRoles, err
}

// createRoles creates a list of roles and returns their id, orgID, name in a single query
func (p *teamPermissionMigrator) createRoles(roles []*accesscontrol.Role, start int, end int) ([]*accesscontrol.Role, error) {
	ts := time.Now()
	createdRoles := make([]*accesscontrol.Role, 0, len(roles))
	valueStrings := make([]string, len(roles))
	args := make([]interface{}, 0, len(roles)*5)

	for i, r := range roles {
		uid, err := generateNewRoleUID(p.sess, r.OrgID)
		if err != nil {
			return nil, err
		}

		valueStrings[i] = "(?, ?, ?, 1, ?, ?)"
		args = append(args, r.OrgID, uid, r.Name, ts, ts)
	}

	// Insert and fetch at once
	valueString := strings.Join(valueStrings, ",")
	sql := fmt.Sprintf("INSERT INTO role (org_id, uid, name, version, created, updated) VALUES %s RETURNING id, org_id, name", valueString)
	if errCreate := p.sess.SQL(sql, args...).Find(&createdRoles); errCreate != nil {
		return nil, errCreate
	}

	return createdRoles, nil
}

// createRolesMySQL creates a list of roles then fetches them
func (p *teamPermissionMigrator) createRolesMySQL(roles []*accesscontrol.Role, start int, end int) ([]*accesscontrol.Role, error) {
	ts := time.Now()
	createdRoles := make([]*accesscontrol.Role, 0, len(roles))

	where := make([]string, len(roles))
	args := make([]interface{}, 0, len(roles)*2)

	for i := range roles {
		uid, err := generateNewRoleUID(p.sess, roles[i].OrgID)
		if err != nil {
			return nil, err
		}

		roles[i].UID = uid
		roles[i].Created = ts
		roles[i].Updated = ts

		where[i] = ("(org_id = ? AND uid = ?)")
		args = append(args, roles[i].OrgID, uid)
	}

	// Insert roles
	if _, errCreate := p.sess.Table("role").Insert(&roles); errCreate != nil {
		return nil, errCreate
	}

	// Fetch newly created roles
	if errFindInsertions := p.sess.Table("role").
		Where(strings.Join(where, " OR "), args...).
		Find(&createdRoles); errFindInsertions != nil {
		return nil, errFindInsertions
	}

	return createdRoles, nil
}

func (p *teamPermissionMigrator) bulkAssignRoles(rolesMap map[string]*accesscontrol.Role, assignments map[int64]map[string]struct{}) error {
	if len(assignments) == 0 {
		return nil
	}

	ts := time.Now()

	roleAssignments := make([]accesscontrol.UserRole, 0, len(assignments))
	for userID, rolesByRoleKey := range assignments {
		for key := range rolesByRoleKey {
			role, ok := rolesMap[key]
			if !ok {
				return &ErrUnknownRole{key}
			}

			roleAssignments = append(roleAssignments, accesscontrol.UserRole{
				OrgID:   role.OrgID,
				RoleID:  role.ID,
				UserID:  userID,
				Created: ts,
			})
		}
	}

	return batch(len(roleAssignments), batchSize, func(start, end int) error {
		roleAssignmentsChunk := roleAssignments[start:end]
		_, err := p.sess.Table("user_role").InsertMulti(roleAssignmentsChunk)
		return err
	})
}

// setRolePermissions sets the role permissions deleting any team related ones before inserting any.
func (p *teamPermissionMigrator) setRolePermissions(roleID int64, permissions []accesscontrol.Permission) error {
	// First drop existing permissions
	if _, errDeletingPerms := p.sess.Exec("DELETE FROM permission WHERE role_id = ? AND (action LIKE ? OR action LIKE ?)", roleID, "teams:%", "teams.permissions:%"); errDeletingPerms != nil {
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

	if _, errInsertPerms := p.sess.InsertMulti(&newPermissions); errInsertPerms != nil {
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

func (p *teamPermissionMigrator) getUserRoleByOrgMapping() (map[int64]map[int64]string, error) {
	var orgUsers []*models.OrgUserDTO
	if err := p.sess.SQL(`SELECT * FROM org_user`).Cols("org_user.org_id", "org_user.user_id", "org_user.role").Find(&orgUsers); err != nil {
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
func (p *teamPermissionMigrator) migrateMemberships() error {
	// Fetch user roles in each org
	userRolesByOrg, err := p.getUserRoleByOrgMapping()
	if err != nil {
		return err
	}

	// Fetch team memberships
	teamMemberships := []*models.TeamMember{}
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
	// * need to be created and assigned (rolesToCreate, assignments)
	// * are already created and assigned (rolesByOrg)
	rolesToCreate, assignments, rolesByOrg, errOrganizeRoles := p.sortRolesToAssign(userPermissionsByOrg)
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
		roleKey := p.getAssignmentKey(createdRoles[i].OrgID, createdRoles[i].Name)
		rolesByOrg[roleKey] = createdRoles[i]
	}

	// Assign newly created roles
	if errAssign := p.bulkAssignRoles(rolesByOrg, assignments); errAssign != nil {
		return errAssign
	}

	// Set all roles teams related permissions
	return p.setRolePermissionsForOrgs(userPermissionsByOrg, rolesByOrg)
}

func (p *teamPermissionMigrator) setRolePermissionsForOrgs(userPermissionsByOrg map[int64]map[int64][]accesscontrol.Permission, rolesByOrg map[string]*accesscontrol.Role) error {
	for orgID, userPermissions := range userPermissionsByOrg {
		for userID, permissions := range userPermissions {
			key := p.getAssignmentKey(orgID, fmt.Sprintf("managed:users:%d:permissions", userID))

			role, ok := rolesByOrg[key]
			if !ok {
				return &ErrUnknownRole{key}
			}

			if errSettingPerms := p.setRolePermissions(role.ID, permissions); errSettingPerms != nil {
				return errSettingPerms
			}
		}
	}
	return nil
}

func (p *teamPermissionMigrator) sortRolesToAssign(userPermissionsByOrg map[int64]map[int64][]accesscontrol.Permission) ([]*accesscontrol.Role, map[int64]map[string]struct{}, map[string]*accesscontrol.Role, error) {
	var rolesToCreate []*accesscontrol.Role

	assignments := map[int64]map[string]struct{}{}

	rolesByOrg := map[string]*accesscontrol.Role{}
	for orgID, userPermissions := range userPermissionsByOrg {
		for userID := range userPermissions {
			roleName := fmt.Sprintf("managed:users:%d:permissions", userID)
			role, errFindingRoles := p.findRole(orgID, roleName)
			if errFindingRoles != nil {
				return nil, nil, nil, errFindingRoles
			}

			roleKey := p.getAssignmentKey(orgID, roleName)

			if role.ID != 0 {
				rolesByOrg[roleKey] = &role
			} else {
				roleToCreate := &accesscontrol.Role{
					Name:  roleName,
					OrgID: orgID,
				}
				rolesToCreate = append(rolesToCreate, roleToCreate)

				userAssignments, initialized := assignments[userID]
				if !initialized {
					userAssignments = map[string]struct{}{}
				}

				userAssignments[roleKey] = struct{}{}
				assignments[userID] = userAssignments
			}
		}
	}

	return rolesToCreate, assignments, rolesByOrg, nil
}

func (p *teamPermissionMigrator) generateAssociatedPermissions(teamMemberships []*models.TeamMember,
	userRolesByOrg map[int64]map[int64]string) (map[int64]map[int64][]accesscontrol.Permission, error) {
	userPermissionsByOrg := map[int64]map[int64][]accesscontrol.Permission{}

	for _, m := range teamMemberships {
		// Downgrade team permissions if needed:
		// only admins or editors (when editorsCanAdmin option is enabled)
		// can access team administration endpoints
		if m.Permission == models.PERMISSION_ADMIN {
			if userRolesByOrg[m.OrgId][m.UserId] == string(models.ROLE_VIEWER) || (userRolesByOrg[m.OrgId][m.UserId] == string(models.ROLE_EDITOR) && !p.editorsCanAdmin) {
				m.Permission = 0

				if _, err := p.sess.Cols("permission").Where("org_id=? and team_id=? and user_id=?", m.OrgId, m.TeamId, m.UserId).Update(m); err != nil {
					return nil, err
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

	return userPermissionsByOrg, nil
}
