package accesscontrol

import (
	"fmt"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	datasourceDrilldownRemoval = "remove the datasources:drilldown action"
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
	result, err := sess.Exec("DELETE FROM permission WHERE action = ?", "datasources:drilldown")
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		mg.Logger.Error("Failed to get rows affected by the datasources:drilldown removal", "error", err)
	} else {
		mg.Logger.Info(fmt.Sprintf("Removed %d datasources:drilldown permissions", rowsAffected))
	}

	return nil
}
