package accesscontrol

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"xorm.io/xorm"
)

type managedPermissionMigrator struct {
	migrator.MigrationBase
}

func (sp *managedPermissionMigrator) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (sp *managedPermissionMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	logger := log.New("managed permissions migrator")

	type Permission struct {
		RoleName string `xorm:"role_name"`
		RoleID   int64  `xorm:"role_id"`
		OrgID    int64  `xorm:"org_id"`
		Action   string
		Scope    string
	}

	// get all orgs
	managedPermissions := []Permission{}
	if errFindPermissions := sess.SQL(`SELECT r.name as role_name, r.id as role_id, r.org_id as org_id,p.action, p.scope
	FROM permission AS p
	INNER JOIN role AS r ON p.role_id = r.id
	WHERE r.name LIKE "managed:builtins%"`).
		Find(&managedPermissions); errFindPermissions != nil {
		logger.Error("could not get the managed permissions", "error", errFindPermissions)
		return errFindPermissions
	}

	roleMap := make(map[int64]map[string]int64)
	permissionMap := make(map[int64]map[string][]Permission)

	// for each managed permission make a map of which permissions need to be added to inheritors
	for _, p := range managedPermissions {
		if _, ok := roleMap[p.OrgID]; !ok {
			roleMap[p.OrgID] = map[string]int64{p.RoleName: p.RoleID}
		} else {
			roleMap[p.OrgID][p.RoleName] = p.RoleID
		}

		roleName := parseRoleFromName(p.RoleName)
		for _, parent := range models.RoleType(roleName).Parents() {
			parentManagedRoleName := "managed:builtins:" + strings.ToLower(string(parent)) + ":permissions"
			if _, ok := permissionMap[p.OrgID]; !ok {
				permissionMap[p.OrgID] = map[string][]Permission{parentManagedRoleName: {p}}
			} else {
				permissionMap[p.OrgID][parentManagedRoleName] = append(permissionMap[p.OrgID][parentManagedRoleName], p)
			}

		}
	}

	now := time.Now()

	// Create missing permissions
	// Example setup:
	// editor read, query datasources:uid:2
	// editor read, query datasources:uid:1
	// admin read, query, write datasources:uid:1
	// we'd need to create admin read, query, write datasources:uid:2
	for orgID, orgMap := range permissionMap {
		for managedRole, permissions := range orgMap {
			// ensure managed role exists, create and add to map if it doesn't
			ok, err := sess.Get(&accesscontrol.Role{Name: managedRole, OrgID: orgID})
			if err != nil {
				return err
			}

			if !ok {
				uid, err := generateNewRoleUID(sess, orgID)
				if err != nil {
					return err
				}
				createdRole := accesscontrol.Role{Name: managedRole, OrgID: orgID, UID: uid, Created: now, Updated: now}
				if _, err := sess.Insert(&createdRole); err != nil {
					logger.Error("Unable to create managed role", "error", err)
					return err
				}

				connection := accesscontrol.BuiltinRole{
					RoleID:  createdRole.ID,
					OrgID:   orgID,
					Role:    parseRoleFromName(createdRole.Name),
					Created: now,
					Updated: now,
				}

				if _, err := sess.Insert(&connection); err != nil {
					logger.Error("Unable to create managed role connection", "error", err)
					return err
				}

				roleMap[orgID][managedRole] = createdRole.ID
			}

			// assign permissions if they don't exist to the role
			existed := 0
			roleID := roleMap[orgID][managedRole]
			for _, p := range permissions {
				perm := accesscontrol.Permission{RoleID: roleID, Action: p.Action, Scope: p.Scope, Created: now, Updated: now}
				if _, err := sess.Insert(&perm); err != nil {
					existed++
				}
			}

			if existed != 0 {
				logger.Warn("Ignoring already existing inherited managed permissions", "existed", existed)
			}
		}
	}

	return nil
}

func parseRoleFromName(roleName string) string {
	return strings.Title(strings.TrimSuffix(strings.TrimPrefix(roleName, "managed:builtins:"), ":permissions"))
}
