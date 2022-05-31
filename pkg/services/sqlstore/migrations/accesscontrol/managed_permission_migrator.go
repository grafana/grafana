// This migration ensures that permissions attributed to a managed role are also granted
// to parent roles.
// Example setup:
// editor read, query datasources:uid:2
// editor read, query datasources:uid:1
// admin read, query, write datasources:uid:1
// we'd need to create admin read, query, write datasources:uid:2

package accesscontrol

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"xorm.io/xorm"
)

const ManagedPermissionsMigrationID = "managed permissions migration"

func AddManagedPermissionsMigration(mg *migrator.Migrator) {
	mg.AddMigration(ManagedPermissionsMigrationID, &managedPermissionMigrator{})
}

type managedPermissionMigrator struct {
	migrator.MigrationBase
}

func (sp *managedPermissionMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
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

	// get all permissions associated with a managed builtin role
	managedPermissions := []Permission{}
	if errFindPermissions := sess.SQL(`SELECT r.name as role_name, r.id as role_id, r.org_id as org_id,p.action, p.scope
	FROM permission AS p
	INNER JOIN role AS r ON p.role_id = r.id
	WHERE r.name LIKE ?`, "managed:builtins%").
		Find(&managedPermissions); errFindPermissions != nil {
		logger.Error("could not get the managed permissions", "error", errFindPermissions)
		return errFindPermissions
	}

	roleMap := make(map[int64]map[string]int64)                     // map[org_id][role_name] = role_id
	permissionMap := make(map[int64]map[string]map[Permission]bool) // map[org_id][role_name][Permission] = toInsert

	// for each managed permission make a map of which permissions need to be added to inheritors
	for _, p := range managedPermissions {
		if _, ok := roleMap[p.OrgID]; !ok {
			roleMap[p.OrgID] = map[string]int64{p.RoleName: p.RoleID}
		} else {
			roleMap[p.OrgID][p.RoleName] = p.RoleID
		}

		// this ensures we can use p as a key in the map between different permissions
		// ensuring we're only comparing on the action and scope
		roleName := p.RoleName
		p.RoleName = ""
		p.RoleID = 0

		// Add the permission to the map of permissions as "false" - already exists
		if _, ok := permissionMap[p.OrgID]; !ok {
			permissionMap[p.OrgID] = map[string]map[Permission]bool{roleName: {p: false}}
		} else {
			if _, ok := permissionMap[p.OrgID][roleName]; !ok {
				permissionMap[p.OrgID][roleName] = map[Permission]bool{p: false}
			} else {
				permissionMap[p.OrgID][roleName][p] = false
			}
		}

		// Add parent roles + permissions to the map as "true" -- need to be inserted
		basicRoleName := ParseRoleFromName(roleName)
		for _, parent := range models.RoleType(basicRoleName).Parents() {
			parentManagedRoleName := "managed:builtins:" + strings.ToLower(string(parent)) + ":permissions"

			if _, ok := permissionMap[p.OrgID][parentManagedRoleName]; !ok {
				permissionMap[p.OrgID][parentManagedRoleName] = map[Permission]bool{p: true}
			} else {
				if _, ok := permissionMap[p.OrgID][parentManagedRoleName][p]; !ok {
					permissionMap[p.OrgID][parentManagedRoleName][p] = true
				}
			}
		}
	}

	now := time.Now()

	// Create missing permissions
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
					Role:    ParseRoleFromName(createdRole.Name),
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
			roleID := roleMap[orgID][managedRole]
			for p, toInsert := range permissions {
				if toInsert {
					perm := accesscontrol.Permission{RoleID: roleID, Action: p.Action, Scope: p.Scope, Created: now, Updated: now}
					if _, err := sess.Insert(&perm); err != nil {
						logger.Error("Unable to create managed permission", "error", err)
						return err
					}
				}
			}
		}
	}

	return nil
}

// Converts from managed:builtins:<role>:permissions to <Role>
// Example: managed:builtins:editor:permissions -> Editor
func ParseRoleFromName(roleName string) string {
	return cases.Title(language.AmericanEnglish).
		String(strings.TrimSuffix(strings.TrimPrefix(roleName, "managed:builtins:"), ":permissions"))
}

const ManagedFolderPermissionsMigrationID = "managed folder permissions migration"

func AddManagedFolderPermissionsMigration(mg *migrator.Migrator) {
	mg.AddMigration(ManagedFolderPermissionsMigrationID, &managedFolderPermissionsMigrator{})
}

type managedFolderPermissionsMigrator struct {
	migrator.MigrationBase
}

func (m *managedFolderPermissionsMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *managedFolderPermissionsMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	// TODO:
	// fetch all managed roles and their permissions
	// check if permissions is "EDIT" or "ADMIN" for folder
	// True - append alert actions
	// False - continue

	var ids []interface{}
	if err := sess.SQL("SELECT id FROM role WHERE name LIKE 'managed:%'").Find(&ids); err != nil {
		return err
	}

	if len(ids) == 0 {
		return nil
	}

	var permissions []accesscontrol.Permission
	if err := sess.SQL("SELECT role_id, action, scope FROM permission WHERE role_id IN(?"+strings.Repeat(" ,?", len(ids)-1)+") AND scope LIKE 'folders:%'", ids...).Find(&permissions); err != nil {
		return err
	}

	mapped := make(map[int64]map[string][]accesscontrol.Permission, len(ids)-1)
	for _, p := range permissions {
		if mapped[p.RoleID] == nil {
			mapped[p.RoleID] = make(map[string][]accesscontrol.Permission)
		}
		mapped[p.RoleID][p.Scope] = append(mapped[p.RoleID][p.Scope], p)
	}

	var toAdd []accesscontrol.Permission
	now := time.Now()

	for id, a := range mapped {
		for scope, p := range a {
			if hasFolderAdmin(p) || hasFolderEdit(p) {
				toAdd = append(
					toAdd,
					accesscontrol.Permission{
						RoleID:  id,
						Action:  accesscontrol.ActionAlertingRuleRead,
						Scope:   scope,
						Updated: now,
						Created: now,
					},
					accesscontrol.Permission{
						RoleID:  id,
						Action:  accesscontrol.ActionAlertingRuleCreate,
						Scope:   scope,
						Updated: now,
						Created: now,
					},
					accesscontrol.Permission{
						RoleID:  id,
						Action:  accesscontrol.ActionAlertingRuleDelete,
						Scope:   scope,
						Updated: now,
						Created: now,
					},
					accesscontrol.Permission{
						RoleID:  id,
						Action:  accesscontrol.ActionAlertingRuleUpdate,
						Scope:   scope,
						Updated: now,
						Created: now,
					},
				)
			}
		}
	}

	if len(toAdd) == 0 {
		return nil
	}

	err := batch(len(toAdd), batchSize, func(start, end int) error {
		if _, err := sess.InsertMulti(toAdd[start:end]); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return err
	}

	return nil
}

func hasFolderAdmin(permissions []accesscontrol.Permission) bool {
	return hasActions(folderPermissionTranslation[models.PERMISSION_ADMIN], permissions)
}

func hasFolderEdit(permissions []accesscontrol.Permission) bool {
	return hasActions(folderPermissionTranslation[models.PERMISSION_EDIT], permissions)
}

func hasActions(actions []string, permissions []accesscontrol.Permission) bool {
	var contains int
	for _, action := range actions {
		for _, p := range permissions {
			if action == p.Action {
				contains++
				break
			}
		}
	}
	return contains >= len(actions)
}
