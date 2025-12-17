package migrations

import (
	_ "embed"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

//go:embed testdata/sqlite_cloud_migration_snapshot_partition_statement.sql
var sqliteMigrationStatement string

func TestConversionOfCloudMigrationSnapshotPartitionPrimaryKey(t *testing.T) {
	names := []string{
		"drop my_row_id and add primary key with columns snapshot_uid,resource_type,partition_number to table cloud_migration_snapshot_partition if my_row_id exists (auto-generated mysql column)",
		"drop unique index UQE_cloud_migration_snapshot_partition_srp_unique with columns snapshot_uid,resource_type,partition_number from cloud_migration_snapshot_partition table if it exists (mysql)",
		"add primary key with columns snapshot_uid,resource_type,partition_number to table cloud_migration_snapshot_partition if it doesn't exist (mysql)",
		"add primary key with columns snapshot_uid,resource_type,partition_number to table cloud_migration_snapshot_partition (postgres and sqlite)",
	}
	expectedMigrations := map[string][]migrator.ExpectedMigration{
		migrator.MySQL: {
			{Id: names[0], SQL: `
				ALTER TABLE cloud_migration_snapshot_partition
				DROP PRIMARY KEY,
				DROP COLUMN my_row_id,
				DROP INDEX UQE_cloud_migration_snapshot_partition_srp_unique,
				ADD PRIMARY KEY (snapshot_uid,resource_type,partition_number);`},
			{Id: names[1], SQL: "ALTER TABLE cloud_migration_snapshot_partition DROP INDEX UQE_cloud_migration_snapshot_partition_srp_unique"},
			{Id: names[2], SQL: "ALTER TABLE cloud_migration_snapshot_partition ADD PRIMARY KEY (snapshot_uid,resource_type,partition_number)"},
			{Id: names[3], SQL: ""},
		},
		migrator.Postgres: {
			{Id: names[0], SQL: ""},
			{Id: names[1], SQL: ""},
			{Id: names[2], SQL: ""},
			{Id: names[3], SQL: `
				DO $$
				BEGIN
					-- Drop the unique constraint if it exists
					DROP INDEX IF EXISTS "UQE_cloud_migration_snapshot_partition_srp_unique";

					-- Add primary key if it doesn't already exist
					IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE indrelid = 'cloud_migration_snapshot_partition'::regclass AND indisprimary) THEN
						ALTER TABLE cloud_migration_snapshot_partition ADD PRIMARY KEY (snapshot_uid,resource_type,partition_number);
					END IF;
				END $$;`},
		},
		migrator.SQLite: {
			{Id: names[0], SQL: ""},
			{Id: names[1], SQL: ""},
			{Id: names[2], SQL: ""},
			{Id: names[3], SQL: sqliteMigrationStatement}, // Embed used here because sqlite statement is full of backquotes.
		},
	}

	for dialectName, migrations := range expectedMigrations {
		t.Run(dialectName, func(t *testing.T) {
			require.NoError(t, migrator.CheckExpectedMigrations(dialectName, migrations, addCloudMigrationsMigrations))
		})
	}
}
