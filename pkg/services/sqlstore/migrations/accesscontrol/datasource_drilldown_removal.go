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
	result, err := sess.Exec("DELETE FROM permission WHERE action IS ?", "%datasources:drilldown%")
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	mg.Logger.Info(fmt.Sprintf("Removed %d datasources:drilldown permissions", rowsAffected))

	return nil
}
