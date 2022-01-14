package database

import (
	"fmt"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func AddTeamMembershipMigrations(mg *migrator.Migrator) {
	mg.AddMigration("teams permissions migration", &teamPermissionMigrator{})
}

var _ migrator.CodeMigration = new(teamPermissionMigrator)

type teamPermissionMigrator struct {
	migrator.MigrationBase
}

func (p *teamPermissionMigrator) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (p *teamPermissionMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	return p.migrateMemberships(&sqlstore.DBSession{Session: sess})
}

// saveRole either creates or role or updates it with additional permissions
func (p *teamPermissionMigrator) saveRole(sess *sqlstore.DBSession, orgID int64, name string, permissions []accesscontrol.Permission) (int64, bool, error) {
	role := &accesscontrol.Role{OrgID: orgID, Name: name}
	has, err := sess.Where("org_id = ? AND name = ?", orgID, name).Get(role)
	if err != nil {
		return 0, false, err
	}

	if !has {
		uid, err := generateNewRoleUID(sess, orgID)
		if err != nil {
			return 0, false, err
		}
		role = &accesscontrol.Role{
			UID:     uid,
			Name:    name,
			OrgID:   orgID,
			Updated: time.Now(),
			Created: time.Now(),
		}
		if _, err := sess.Insert(role); err != nil {
			return 0, false, err
		}
	}

	now := time.Now()
	for p := range permissions {
		permissions[p].RoleID = role.ID
		permissions[p].Created = now
		permissions[p].Updated = now
	}

	_, err = sess.InsertMulti(&permissions)
	if err != nil {
		return 0, false, err
	}

	return role.ID, has, nil
}

// mapPermissionToFGAC translates the legacy membership (Member or Admin) into FGAC permissions
func (p *teamPermissionMigrator) mapPermissionToFGAC(permission models.PermissionType, teamId int64) []accesscontrol.Permission {
	switch permission {
	case 0:
		return []accesscontrol.Permission{{Action: "teams:read", Scope: accesscontrol.Scope("teams", "id", string(teamId))}}
	case models.PERMISSION_ADMIN:
		return []accesscontrol.Permission{
			{Action: "teams:create", Scope: accesscontrol.Scope("teams", "id", string(teamId))},
			{Action: "teams:delete", Scope: accesscontrol.Scope("teams", "id", string(teamId))},
			{Action: "teams:read", Scope: accesscontrol.Scope("teams", "id", string(teamId))},
			{Action: "teams:write", Scope: accesscontrol.Scope("teams", "id", string(teamId))},
			{Action: "teams.permissions:read", Scope: accesscontrol.Scope("teams", "id", string(teamId))},
			{Action: "teams.permissions:write", Scope: accesscontrol.Scope("teams", "id", string(teamId))},
		}
	default:
		return []accesscontrol.Permission{}
	}
}

// migrateMemberships generate managed permissions for users based on their memberships to teams
func (p *teamPermissionMigrator) migrateMemberships(sess *sqlstore.DBSession) error {
	var members []models.TeamMember
	if err := sess.SQL(`SELECT * FROM team_member`).Find(&members); err != nil {
		return err
	}

	var userPermissionsByOrg map[int64]map[int64][]accesscontrol.Permission

	// Loop through memberships and generate associated permissions
	for _, m := range members {
		permissions := userPermissionsByOrg[m.OrgId][m.Id]
		permissions = append(permissions, p.mapPermissionToFGAC(m.Permission, m.TeamId)...)
	}

	// Loop through generated permissions and store them
	for orgID, userPermissions := range userPermissionsByOrg {
		for userID, permissions := range userPermissions {
			roleID, existed, err := p.saveRole(sess, orgID, fmt.Sprintf("managed:users:%d:permissions", userID), permissions)
			if err != nil {
				return err
			}
			if !existed {
				_, err = sess.Table("user_role").Insert(accesscontrol.UserRole{
					OrgID:   orgID,
					RoleID:  roleID,
					UserID:  userID,
					Created: time.Now(),
				})
				if err != nil {
					return err
				}
			}
		}
	}

	return nil
}
