package migrations

import (
	"fmt"

	. "github.com/Cepave/grafana/pkg/services/sqlstore/migrator"
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
