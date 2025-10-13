package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addCloudMigrationsMigrations(mg *Migrator) {
	// --- v1 - synchronous workflow
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

	// --- v2 - asynchronous workflow refactor
	migrationSessionTable := Table{
		Name: "cloud_migration_session",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: true},
			{Name: "auth_token", Type: DB_Text, Nullable: true}, // encrypted
			{Name: "slug", Type: DB_Text},
			{Name: "stack_id", Type: DB_BigInt, Nullable: false},
			{Name: "region_slug", Type: DB_Text, Nullable: false},
			{Name: "cluster_slug", Type: DB_Text, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"uid"}, Type: UniqueIndex},
		},
	}
	migrationSnapshotTable := Table{
		Name: "cloud_migration_snapshot",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: true},
			{Name: "session_uid", Type: DB_NVarchar, Length: 40, Nullable: true}, // get from the cloud service
			{Name: "result", Type: DB_Text, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
			{Name: "finished", Type: DB_DateTime, Nullable: true},
		},
		Indices: []*Index{
			{Cols: []string{"uid"}, Type: UniqueIndex},
		},
	}

	addTableReplaceMigrations(mg, migrationTable, migrationSessionTable, 2, map[string]string{
		"id":           "id",
		"uid":          "uid",
		"auth_token":   "auth_token",
		"slug":         "stack",
		"stack_id":     "stack_id",
		"region_slug":  "region_slug",
		"cluster_slug": "cluster_slug",
		"created":      "created",
		"updated":      "updated",
	})

	addTableReplaceMigrations(mg, migrationRunTable, migrationSnapshotTable, 2, map[string]string{
		"id":          "id",
		"uid":         "uid",
		"session_uid": "cloud_migration_uid",
		"result":      "result",
		"created":     "created",
		"updated":     "updated",
		"finished":    "finished",
	})

	// --- add new columns to snapshots table
	uploadUrlColumn := Column{Name: "upload_url", Type: DB_Text, Nullable: true}
	mg.AddMigration("add snapshot upload_url column", NewAddColumnMigration(migrationSnapshotTable, &uploadUrlColumn))

	statusColumn := Column{Name: "status", Type: DB_Text, Nullable: false}
	mg.AddMigration("add snapshot status column", NewAddColumnMigration(migrationSnapshotTable, &statusColumn))

	localDirColumn := Column{Name: "local_directory", Type: DB_Text, Nullable: true}
	mg.AddMigration("add snapshot local_directory column", NewAddColumnMigration(migrationSnapshotTable, &localDirColumn))

	gmsSnapshotUIDColumn := Column{Name: "gms_snapshot_uid", Type: DB_Text, Nullable: true}
	mg.AddMigration("add snapshot gms_snapshot_uid column", NewAddColumnMigration(migrationSnapshotTable, &gmsSnapshotUIDColumn))

	encryptionKeyColumn := Column{Name: "encryption_key", Type: DB_Text, Nullable: true}
	mg.AddMigration("add snapshot encryption_key column", NewAddColumnMigration(migrationSnapshotTable, &encryptionKeyColumn))

	errorStringColumn := Column{Name: "error_string", Type: DB_Text, Nullable: true}
	mg.AddMigration("add snapshot error_string column", NewAddColumnMigration(migrationSnapshotTable, &errorStringColumn))

	// --- create table for tracking resource migrations
	migrationResourceTable := Table{
		Name: "cloud_migration_resource",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "resource_type", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "resource_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "status", Type: DB_NVarchar, Length: 20, Nullable: false},
			{Name: "error_string", Type: DB_Text, Nullable: true},
			{Name: "snapshot_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
		},
	}

	mg.AddMigration("create cloud_migration_resource table v1", NewAddTableMigration(migrationResourceTable))

	// -- delete the snapshot result column while still in the experimental phase
	mg.AddMigration("delete cloud_migration_snapshot.result column", NewRawSQLMigration("ALTER TABLE cloud_migration_snapshot DROP COLUMN result"))

	mg.AddMigration("add cloud_migration_resource.name column", NewAddColumnMigration(migrationResourceTable, &Column{
		Name:     "name",
		Type:     DB_Text,
		Nullable: true,
	}))

	mg.AddMigration("add cloud_migration_resource.parent_name column", NewAddColumnMigration(migrationResourceTable, &Column{
		Name:     "parent_name",
		Type:     DB_Text,
		Nullable: true,
	}))

	// -- Adds org_id column for for all elements - defaults to 1 (default org)
	mg.AddMigration("add cloud_migration_session.org_id column", NewAddColumnMigration(migrationSessionTable, &Column{
		Name: "org_id", Type: DB_BigInt, Nullable: false, Default: "1",
	}))

	mg.AddMigration("add cloud_migration_resource.error_code column", NewAddColumnMigration(migrationResourceTable, &Column{
		Name:     "error_code",
		Type:     DB_Text,
		Nullable: true,
	}))

	// -- increase the length of resource_uid column
	// -- not needed in sqlite as type is TEXT with length defined by SQLITE_MAX_LENGTH preprocessor macro
	mg.AddMigration("increase resource_uid column length", NewRawSQLMigration("").
		Mysql("ALTER TABLE cloud_migration_resource MODIFY resource_uid NVARCHAR(255);").
		Postgres("ALTER TABLE cloud_migration_resource ALTER COLUMN resource_uid TYPE VARCHAR(255);"))
}
