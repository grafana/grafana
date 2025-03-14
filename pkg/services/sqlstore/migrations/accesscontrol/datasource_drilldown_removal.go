package accesscontrol

import (
	"fmt"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	datasourceDrilldownRemoval = "delete datasources:drilldown action and its assignments"
)

func AddDatasourceDrilldownRemovalMigration(mg *migrator.Migrator) {
	mg.AddMigration(datasourceDrilldownRemoval, &datasourceDrilldownRemovalMigrator{})
}

type datasourceDrilldownRemovalMigrator struct {
	migrator.MigrationBase
}

func (m *datasourceDrilldownRemovalMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *datasourceDrilldownRemovalMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	// Do we need to remove the role assignments for this action?
	result, err := sess.Exec("DELETE FROM permission WHERE action = 'datasources:drilldown'")
	if err != nil {
		return fmt.Errorf("failed to delete datasources:drilldown permissions: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		mg.Logger.Info("Removed datasources:drilldown permissions, but couldn't determine how many")
	} else {
		mg.Logger.Info(fmt.Sprintf("Removed %d datasources:drilldown permissions", rowsAffected))
	}

	seedResult, err := sess.Exec("DELETE FROM seed_assignment WHERE action = 'datasources:drilldown'")
	if err != nil {
		return fmt.Errorf("failed to delete datasources:drilldown seed assignments: %w", err)
	}

	seedRowsAffected, err := seedResult.RowsAffected()
	if err != nil {
		mg.Logger.Info("Removed datasources:drilldown seed assignments, but couldn't determine how many")
	} else {
		mg.Logger.Info(fmt.Sprintf("Removed %d datasources:drilldown seed assignments", seedRowsAffected))
	}

	return nil
}
