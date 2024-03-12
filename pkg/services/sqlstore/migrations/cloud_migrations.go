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
			{Name: "stack", Type: DB_Text},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
	}
	migrationRunTable := Table{
		Name: "cloud_migration_run",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "cloud_migration_uid", Type: DB_NVarchar, Length: 40, Nullable: true}, // get from the cloud service
			{Name: "result", Type: DB_Text, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
			{Name: "finished", Type: DB_DateTime, Nullable: true},
		},
	}

	mg.AddMigration("create cloud_migration table v1", NewAddTableMigration(migrationTable))
	mg.AddMigration("create cloud_migration_run table v1", NewAddTableMigration(migrationRunTable))
}
