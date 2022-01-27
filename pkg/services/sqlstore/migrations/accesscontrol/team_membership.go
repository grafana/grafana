package accesscontrol

import (
	"fmt"
	"strconv"
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

// addPermissionsToRole either finds the role or creates a new role
func (p *teamPermissionMigrator) getOrCreateManagedRole(sess *xorm.Session, orgID, userID int64, name string) (int64, error) {
	role := &accesscontrol.Role{OrgID: orgID, Name: name}
	has, err := sess.Where("org_id = ? AND name = ?", orgID, name).Get(role)
	if err != nil {
		return 0, err
	}

	if !has {
		uid, err := generateNewRoleUID(sess, orgID)
		if err != nil {
			return 0, err
		}

		now := time.Now()
		role = &accesscontrol.Role{
			UID:     uid,
			Name:    name,
			OrgID:   orgID,
			Updated: now,
			Created: now,
		}
		if _, err := sess.Insert(role); err != nil {
			return 0, err
		}

		_, err = sess.Table("user_role").Insert(accesscontrol.UserRole{
			OrgID:   orgID,
			RoleID:  role.ID,
			UserID:  userID,
			Created: time.Now(),
		})
		if err != nil {
			return 0, err
		}
	}

	return role.ID, nil
}

// addPermissionsToRole updates role with any newly added permissions
func (p *teamPermissionMigrator) addPermissionsToRole(sess *xorm.Session, roleID int64, permissions []accesscontrol.Permission) error {
	var newPermissions []accesscontrol.Permission
	for _, permission := range permissions {
		has, err := sess.Where("role_id = ? AND action = ? AND scope = ?", roleID, permission.Action, permission.Scope).Get(&accesscontrol.Permission{})
		if err != nil {
			return err
		}
		if !has {
			now := time.Now()
			permission.RoleID = roleID
			permission.Created = now
			permission.Updated = now
			newPermissions = append(newPermissions, permission)
		}
	}

	_, err := sess.InsertMulti(&newPermissions)
	if err != nil {
		return err
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

	// Loop through generated permissions and store them
	for orgID, userPermissions := range userPermissionsByOrg {
		for userID, permissions := range userPermissions {
			roleID, err := p.getOrCreateManagedRole(sess, orgID, userID, fmt.Sprintf("managed:users:%d:permissions", userID))
			if err != nil {
				return err
			}
			err = p.addPermissionsToRole(sess, roleID, permissions)
			if err != nil {
				return err
			}
		}
	}

	return nil
}
