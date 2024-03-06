package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addCloudMigrationsMigrations(mg *Migrator) {
	migrationTable := Table{
		Name: "cloud_migration",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "auth_token", Type: DB_Text, Nullable: true}, // encrypted
			{Name: "stack", Type: DB_Text, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
	}
	migrationRunTable := Table{
		Name: "cloud_migration_run",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "cloud_migration_uid", Type: DB_NVarchar, Length: 255, Nullable: false}, // get from the cloud service
			{Name: "result", Type: DB_Text, Nullable: true},                                // encrypted
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
			{Name: "finished", Type: DB_DateTime, Nullable: true},
		},
	}
	// cloud knows
	// - cloud_migration_uid (shared with onprem)
	// - migration data
	// - stack name

	mg.AddMigration("cloud_migration table", NewAddTableMigration(migrationTable))
	mg.AddMigration("cloud_migration_run table", NewAddTableMigration(migrationRunTable))
}
