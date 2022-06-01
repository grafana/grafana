package accesscontrol

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"

	"xorm.io/xorm"
)

func AddActionNameMigrator(mg *migrator.Migrator) {
	mg.AddMigration("RBAC action name migrator", &actionNameMigrator{})
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
		"teams.roles:list":         "teams.roles:read",
		"users.roles:list":         "users.roles:read",
		"users.authtoken:list":     accesscontrol.ActionUsersAuthTokenList,
		"users.quotas:list":        accesscontrol.ActionUsersQuotasList,
		"users.permissions:list":   "users.permissions:read",
		"alert.instances:update":   accesscontrol.ActionAlertingInstanceUpdate,
		"alert.rules:update":       accesscontrol.ActionAlertingRuleUpdate,
	}
	for oldName, newName := range actionNameMapping {
		_, err := m.sess.Table(&accesscontrol.Permission{}).Where("action = ?", oldName).Update(&accesscontrol.Permission{Action: newName})
		if err != nil {
			return fmt.Errorf("failed to update permission table for action %s: %w", oldName, err)
		}
	}

	actionsToDelete := []string{"users.teams:read", "roles:list"}
	for _, action := range actionsToDelete {
		_, err := m.sess.Table(&accesscontrol.Permission{}).Where("action = ?", action).Delete(accesscontrol.Permission{})
		if err != nil {
			return fmt.Errorf("failed to update permission table for action %s: %w", action, err)
		}
	}

	return nil
}
