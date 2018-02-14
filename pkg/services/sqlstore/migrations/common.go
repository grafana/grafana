package migrations

import (
	"fmt"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addDropAllIndicesMigrations(mg *Migrator, versionSuffix string, table Table) {
	for _, index := range table.Indices {
		migrationId := fmt.Sprintf("drop index %s - %s", index.XName(table.Name), versionSuffix)
		mg.AddMigration(migrationId, NewDropIndexMigration(table, index))
	}
}

func addTableIndicesMigrations(mg *Migrator, versionSuffix string, table Table) {
	for _, index := range table.Indices {
		migrationId := fmt.Sprintf("create index %s - %s", index.XName(table.Name), versionSuffix)
		mg.AddMigration(migrationId, NewAddIndexMigration(table, index))
	}
}

func addTableRenameMigration(mg *Migrator, oldName string, newName string, versionSuffix string) {
	migrationId := fmt.Sprintf("Rename table %s to %s - %s", oldName, newName, versionSuffix)
	mg.AddMigration(migrationId, NewRenameTableMigration(oldName, newName))
}

func addTableReplaceMigrations(mg *Migrator, from Table, to Table, migrationVersion int64, tableDataMigration map[string]string) {
	fromV := fmt.Sprintf("v%v", migrationVersion-1)
	toV := fmt.Sprintf("v%v", migrationVersion)
	tmpTableName := "dashboard_provisioning_" + fromV

	addTableRenameMigration(mg, from.Name, tmpTableName, fromV)
	mg.AddMigration(fmt.Sprintf("create %v %v", to.Name, toV), NewAddTableMigration(to))
	addTableIndicesMigrations(mg, toV, to)
	mg.AddMigration(fmt.Sprintf("copy %v %v to %v", to.Name, fromV, toV), NewCopyTableDataMigration(to.Name, tmpTableName, tableDataMigration))
	mg.AddMigration(fmt.Sprintf("drop %v", tmpTableName), NewDropTableMigration(tmpTableName))
}
