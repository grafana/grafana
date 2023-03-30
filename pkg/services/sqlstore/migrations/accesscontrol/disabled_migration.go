package accesscontrol

import (
	"fmt"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	disabledMigrationID                     = "rbac disabled migrator"
	teamMigrationID                         = "teams permissions migration"
	dashboardMigrationID                    = "dashboard permissions"
	dashboardsUIDMigrationID                = "dashboard permissions uid scopes"
	datasourceMigrationID                   = "data source permissions"
	datasourceUIDMigrationID                = "data source uid permissions"
	managedPermissionsMigrationID           = "managed permissions migration"
	alertFolderMigrationID                  = "managed folder permissions alert actions repeated migration"
	managedPermissionsEnterpriseMigrationID = "managed permissions migration enterprise"
)

var migrations = [...]string{
	teamMigrationID,
	dashboardMigrationID,
	dashboardsUIDMigrationID,
	datasourceMigrationID,
	datasourceUIDMigrationID,
	managedPermissionsMigrationID,
	alertFolderMigrationID,
	managedPermissionsEnterpriseMigrationID,
}

func AddDisabledMigrator(mg *migrator.Migrator) {
	mg.AddMigration(disabledMigrationID, &DisabledMigrator{})
}

type DisabledMigrator struct {
	migrator.MigrationBase
}

func (m *DisabledMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *DisabledMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	enabled := mg.Cfg.Raw.Section("rbac").Key("enabled").MustBool(true)
	if enabled {
		// if the flag is enabled we skip the reset of data migrations
		mg.Logger.Debug("skip reset of rbac data migrations")
		return nil
	}

	if _, err := sess.Exec("DELETE FROM builtin_role WHERE role_id IN (SELECT id FROM role WHERE name LIKE 'managed:%')"); err != nil {
		return fmt.Errorf("failed to remove basic role bindings: %w", err)
	}

	if _, err := sess.Exec("DELETE FROM team_role WHERE role_id IN (SELECT id FROM role WHERE name LIKE 'managed:%')"); err != nil {
		return fmt.Errorf("failed to remove team role bindings: %w", err)
	}

	if _, err := sess.Exec("DELETE FROM user_role where role_id IN (SELECT id FROM role WHERE name LIKE 'managed:%')"); err != nil {
		return fmt.Errorf("failed to remove user role bindings: %w", err)
	}

	if _, err := sess.Exec("DELETE FROM permission WHERE role_id IN (SELECT id FROM role WHERE name LIKE 'managed:%');"); err != nil {
		return fmt.Errorf("failed to remove managed rbac permission: %w", err)
	}

	if _, err := sess.Exec("DELETE FROM role WHERE name LIKE 'managed:%';"); err != nil {
		return fmt.Errorf("failed to remove managed rbac roles: %w", err)
	}

	params := []interface{}{"DELETE FROM migration_log WHERE migration_id IN (?, ?, ?, ?, ?, ?, ?, ?)"}
	for _, m := range migrations {
		params = append(params, m)
	}

	if _, err := sess.Exec(params...); err != nil {
		return fmt.Errorf("failed to remove managed permissions migrations: %w", err)
	}

	return nil
}
