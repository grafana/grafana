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
	return "code migration"
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
	}

	for oldName, newName := range actionNameMapping {
		_, err := m.sess.Table(&accesscontrol.Permission{}).Where("action = ?", oldName).Update(&accesscontrol.Permission{Action: newName})
		if err != nil {
			return fmt.Errorf("failed to update permission table: %w", err)
		}
	}

	_, err := m.sess.Table(&accesscontrol.Permission{}).Where("action = ?", "users.teams:read").Delete(accesscontrol.Permission{})
	if err != nil {
		return fmt.Errorf("failed to update permission table: %w", err)
	}

	return nil
}
