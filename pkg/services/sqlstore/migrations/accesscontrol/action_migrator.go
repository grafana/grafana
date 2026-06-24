package accesscontrol

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const ActionMigrationID = "RBAC action name migrator"

func AddActionNameMigrator(mg *migrator.Migrator) {
	mg.AddMigration(ActionMigrationID, &actionNameMigrator{})
}

type actionNameMigrator struct {
	sess     *xorm.Session
	migrator *migrator.Migrator
	migrator.MigrationBase
}

var _ migrator.CodeMigration = new(actionNameMigrator)

func (m *actionNameMigrator) SQL(migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *actionNameMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	m.sess = sess
	m.migrator = migrator
	return m.migrateActionNames()
}

func (m *actionNameMigrator) migrateActionNames() error {
	actionNameMapping := map[string]string{
		"licensing:update":         "licensing:write",
		"reports.admin:create":     "reports:create",
		"reports.admin:write":      "reports:write",
		"org.users.role:update":    accesscontrol.ActionOrgUsersWrite,
		"users.authtoken:update":   accesscontrol.ActionUsersAuthTokenUpdate,
		"users.password:update":    accesscontrol.ActionUsersPasswordUpdate,
		"users.permissions:update": accesscontrol.ActionUsersPermissionsUpdate,
		"users.quotas:update":      accesscontrol.ActionUsersQuotasUpdate,
		"roles:list":               "roles:read",
		"teams.roles:list":         "teams.roles:read",
		"users.roles:list":         "users.roles:read",
		"users.authtoken:list":     accesscontrol.ActionUsersAuthTokenList,
		"users.quotas:list":        accesscontrol.ActionUsersQuotasList,
		"users.permissions:list":   "users.permissions:read",
		"alert.instances:update":   accesscontrol.ActionAlertingInstanceUpdate,
		"alert.rules:update":       accesscontrol.ActionAlertingRuleUpdate,
	}

	oldActionNames := make([]any, 0, len(actionNameMapping))
	newActionNames := make([]any, 0, len(actionNameMapping))
	for oldName, newName := range actionNameMapping {
		oldActionNames = append(oldActionNames, oldName)
		newActionNames = append(newActionNames, newName)
	}

	actionNameQuery := strings.Builder{}
	actionNameQuery.WriteRune(' ')
	actionNameQuery.WriteString("action IN ")
	actionNameQuery.WriteString("(?")
	actionNameQuery.WriteString(strings.Repeat(",?", len(actionNameMapping)-1))
	actionNameQuery.WriteRune(')')

	oldActionNamePermissions := make([]*accesscontrol.Permission, 0)
	err := m.sess.Where(actionNameQuery.String(), oldActionNames...).Find(&oldActionNamePermissions)
	if err != nil {
		return fmt.Errorf("failed to list permissions with legacy action names: %w", err)
	}

	newActionNamePermissions := make([]*accesscontrol.Permission, 0)
	err = m.sess.Where(actionNameQuery.String(), newActionNames...).Find(&newActionNamePermissions)
	if err != nil {
		return fmt.Errorf("failed to list permissions with new action names: %w", err)
	}

	permissionsToCreate := make([]*accesscontrol.Permission, 0)
	for _, oldNamePermission := range oldActionNamePermissions {
		newPermission := oldNamePermission
		newPermission.Action = actionNameMapping[oldNamePermission.Action]

		// if there already is a permission in the database with the new action name and the same role ID and scope as the old permissions,
		// we can just drop the old permission (otherwise the permission table uniqueness constraint won't be satisfied)
		newNamePermissionExists := false
		// note - there should not be many permissions with the new action names, so this should not be an expensive iteration
		for _, existingPermission := range newActionNamePermissions {
			if existingPermission.Action == newPermission.Action &&
				existingPermission.RoleID == newPermission.RoleID &&
				existingPermission.Scope == newPermission.Scope {
				newNamePermissionExists = true
				continue
			}
		}
		if newNamePermissionExists {
			continue
		}

		permissionsToCreate = append(permissionsToCreate, oldNamePermission)
	}

	if _, err := m.sess.Where(actionNameQuery.String(), oldActionNames...).Delete(accesscontrol.Permission{}); err != nil {
		return fmt.Errorf("failed to delete permissions with legacy action names: %w", err)
	}
	if len(permissionsToCreate) != 0 {
		if _, err := m.sess.InsertMulti(permissionsToCreate); err != nil {
			return fmt.Errorf("failed to create permissions with the new action names: %w", err)
		}
	}

	return nil
}
