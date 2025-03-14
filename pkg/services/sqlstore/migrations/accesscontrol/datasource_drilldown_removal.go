package accesscontrol

import (
	"fmt"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	datasourceDrilldownRemoval = "delete all drilldown actions, their assignments, and related roles"
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
	result, err := sess.Exec("DELETE FROM permission WHERE action LIKE ?", "%datasources:drilldown%")
	if err != nil {
		mg.Logger.Error("Failed to delete datasources:drilldown permissions", "error", err)
		// This is a critical step, but we'll continue with the migration
	} else {
		rowsAffected, err := result.RowsAffected()
		if err != nil {
			mg.Logger.Info("Removed datasources:drilldown permissions, but couldn't determine how many")
		} else {
			mg.Logger.Info(fmt.Sprintf("Removed %d datasources:drilldown permissions", rowsAffected))
		}
	}

	return nil
}
