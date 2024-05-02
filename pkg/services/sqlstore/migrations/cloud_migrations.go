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

	stackIDColumn := Column{Name: "stack_id", Type: DB_BigInt, Nullable: false}
	regionSlugColumn := Column{Name: "region_slug", Type: DB_Text, Nullable: false}
	clusterSlugColumn := Column{Name: "cluster_slug", Type: DB_Text, Nullable: false}

	mg.AddMigration("add stack_id column", NewAddColumnMigration(migrationTable, &stackIDColumn))
	mg.AddMigration("add region_slug column", NewAddColumnMigration(migrationTable, &regionSlugColumn))
	mg.AddMigration("add cluster_slug column", NewAddColumnMigration(migrationTable, &clusterSlugColumn))

	// --- adding uid to migration
	migUidColumn := Column{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: true}
	mg.AddMigration("add migration uid column", NewAddColumnMigration(migrationTable, &migUidColumn))

	mg.AddMigration("Update uid column values for migration", NewRawSQLMigration("").
		SQLite("UPDATE cloud_migration SET uid=printf('u%09d',id) WHERE uid IS NULL;").
		Postgres("UPDATE `cloud_migration` SET uid='u' || lpad('' || id::text,9,'0') WHERE uid IS NULL;").
		Mysql("UPDATE cloud_migration SET uid=concat('u',lpad(id,9,'0')) WHERE uid IS NULL;"))

	mg.AddMigration("Add unique index migration_uid", NewAddIndexMigration(migrationTable, &Index{
		Cols: []string{"uid"}, Type: UniqueIndex,
	}))

	// --- adding uid to migration run
	runUidColumn := Column{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: true}
	mg.AddMigration("add migration run uid column", NewAddColumnMigration(migrationRunTable, &runUidColumn))

	mg.AddMigration("Update uid column values for migration run", NewRawSQLMigration("").
		SQLite("UPDATE cloud_migration_run SET uid=printf('u%09d',id) WHERE uid IS NULL;").
		Postgres("UPDATE `cloud_migration_run` SET uid='u' || lpad('' || id::text,9,'0') WHERE uid IS NULL;").
		Mysql("UPDATE cloud_migration_run SET uid=concat('u',lpad(id,9,'0')) WHERE uid IS NULL;"))

	mg.AddMigration("Add unique index migration_run_uid", NewAddIndexMigration(migrationRunTable, &Index{
		Cols: []string{"uid"}, Type: UniqueIndex,
	}))
}
