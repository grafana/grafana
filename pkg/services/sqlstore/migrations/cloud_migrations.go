package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addCloudMigrationsMigrations(mg *Migrator) {
	migrationSessionTable := Table{
		Name: "cloud_migration_session",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "auth_token", Type: DB_Text, Nullable: true}, // encrypted
			{Name: "slug", Type: DB_Text},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
	}
	migrationSnapshotTable := Table{
		Name: "cloud_migration_snapshot",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "session_uid", Type: DB_NVarchar, Length: 40, Nullable: true}, // get from the cloud service
			{Name: "result", Type: DB_Text, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
			{Name: "finished", Type: DB_DateTime, Nullable: true},
		},
	}

	mg.AddMigration("create cloud_migration_session table v1", NewAddTableMigration(migrationSessionTable))
	mg.AddMigration("create cloud_migration_snapshot table v1", NewAddTableMigration(migrationSnapshotTable))

	stackIDColumn := Column{Name: "stack_id", Type: DB_BigInt, Nullable: false}
	regionSlugColumn := Column{Name: "region_slug", Type: DB_Text, Nullable: false}
	clusterSlugColumn := Column{Name: "cluster_slug", Type: DB_Text, Nullable: false}

	mg.AddMigration("add stack_id column", NewAddColumnMigration(migrationSessionTable, &stackIDColumn))
	mg.AddMigration("add region_slug column", NewAddColumnMigration(migrationSessionTable, &regionSlugColumn))
	mg.AddMigration("add cluster_slug column", NewAddColumnMigration(migrationSessionTable, &clusterSlugColumn))

	// --- adding uid to session
	sessUidColumn := Column{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: true}
	mg.AddMigration("add session uid column", NewAddColumnMigration(migrationSessionTable, &sessUidColumn))

	mg.AddMigration("Update uid column values for cloud_migration_session", NewRawSQLMigration("").
		SQLite("UPDATE cloud_migration_session SET uid=printf('u%09d',id) WHERE uid IS NULL;").
		Postgres("UPDATE `cloud_migration_session` SET uid='u' || lpad('' || id::text,9,'0') WHERE uid IS NULL;").
		Mysql("UPDATE cloud_migration_session SET uid=concat('u',lpad(id,9,'0')) WHERE uid IS NULL;"))

	mg.AddMigration("Add unique index migration_uid", NewAddIndexMigration(migrationSessionTable, &Index{
		Cols: []string{"uid"}, Type: UniqueIndex,
	}))

	// --- adding uid to snapshot
	snapshotUidColumn := Column{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: true}
	mg.AddMigration("add snapshot uid column", NewAddColumnMigration(migrationSnapshotTable, &snapshotUidColumn))

	mg.AddMigration("Update uid column values for cloud_migration_snapshot", NewRawSQLMigration("").
		SQLite("UPDATE cloud_migration_snapshot SET uid=printf('u%09d',id) WHERE uid IS NULL;").
		Postgres("UPDATE `cloud_migration_snapshot` SET uid='u' || lpad('' || id::text,9,'0') WHERE uid IS NULL;").
		Mysql("UPDATE cloud_migration_snapshot SET uid=concat('u',lpad(id,9,'0')) WHERE uid IS NULL;"))

	mg.AddMigration("Add unique index migration_run_uid", NewAddIndexMigration(migrationSnapshotTable, &Index{
		Cols: []string{"uid"}, Type: UniqueIndex,
	}))
}
