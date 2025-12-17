package migrator

import (
	_ "embed"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

//go:embed testdata/sqlite_file_migration_statement.sql
var sqliteMigrationStatement string

func TestConvertUniqueKeyToPrimaryKey(t *testing.T) {
	expectedMigrations := func(names []string) map[string][]ExpectedMigration {
		return map[string][]ExpectedMigration{
			MySQL: {
				{Id: names[0], SQL: `
			  ALTER TABLE file
			  DROP PRIMARY KEY,
			  DROP COLUMN my_row_id,
			  DROP INDEX UQE_file_path_hash_etag,
			  ADD PRIMARY KEY (` + "`path_hash`" + `,` + "`etag`" + `);`},
				{Id: names[1], SQL: "ALTER TABLE file DROP INDEX UQE_file_path_hash_etag"},
				{Id: names[2], SQL: "ALTER TABLE file ADD PRIMARY KEY (`path_hash`,`etag`)"},
				{Id: names[3], SQL: ""},
			},
			Postgres: {
				{Id: names[0], SQL: ""},
				{Id: names[1], SQL: ""},
				{Id: names[2], SQL: ""},
				{Id: names[3], SQL: `
				DO $$
				BEGIN
					-- Drop the unique constraint if it exists
					DROP INDEX IF EXISTS "UQE_file_path_hash_etag";

					-- Add primary key if it doesn't already exist
					IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE indrelid = 'file'::regclass AND indisprimary) THEN
					ALTER TABLE file ADD PRIMARY KEY (path_hash,etag);
				END IF;
				END $$;`},
			},
			SQLite: {
				{Id: names[0], SQL: ""},
				{Id: names[1], SQL: ""},
				{Id: names[2], SQL: ""},
				{Id: names[3], SQL: sqliteMigrationStatement}, // Embed used here because sqlite statement is full of backquotes.
			},
		}
	}

	type testCase struct {
		migrationNamesParam    []string // Passed to ConvertUniqueKeyToPrimaryKey
		migrationNamesExpected []string // Used to build migrations map
	}

	testCases := map[string]testCase{
		"default names": {migrationNamesParam: nil, migrationNamesExpected: []string{
			"drop my_row_id and add primary key with columns path_hash,etag to table file if my_row_id exists (auto-generated mysql column)",
			"drop unique index UQE_file_path_hash_etag from file table if it exists (mysql)",
			"add primary key with columns path_hash,etag to table file if it doesn't exist (mysql)",
			"add primary key with columns path_hash,etag to table file (postgres and sqlite)",
		}},
		"supplied names": {migrationNamesParam: []string{"a", "b", "c", "d"}, migrationNamesExpected: []string{"a", "b", "c", "d"}},
		"partially supplied names": {migrationNamesParam: []string{"a", "", "c"}, migrationNamesExpected: []string{
			"a",
			"drop unique index UQE_file_path_hash_etag from file table if it exists (mysql)",
			"c",
			"add primary key with columns path_hash,etag to table file (postgres and sqlite)",
		}},
	}

	for name, tc := range testCases {
		for dialectName, migrations := range expectedMigrations(tc.migrationNamesExpected) {
			t.Run(fmt.Sprintf("%s-%s", name, dialectName), func(t *testing.T) {
				err := CheckExpectedMigrations(dialectName, migrations, func(migrator *Migrator) {
					ConvertUniqueKeyToPrimaryKey(migrator,
						Index{Cols: []string{"path_hash", "etag"}, Type: UniqueIndex}, // Convert this unique key to primary key
						Table{
							Name: "file",
							Columns: []*Column{
								{Name: "path", Type: DB_NVarchar, Length: 1024, Nullable: false},
								{Name: "path_hash", Type: DB_NVarchar, Length: 64, Nullable: false, IsPrimaryKey: true},
								{Name: "parent_folder_path_hash", Type: DB_NVarchar, Length: 64, Nullable: false},
								{Name: "contents", Type: DB_Blob, Nullable: false},
								{Name: "etag", Type: DB_NVarchar, Length: 32, Nullable: false, IsPrimaryKey: true},
							},
							PrimaryKeys: []string{"path_hash", "etag"},
							Indices: []*Index{
								{Cols: []string{"parent_folder_path_hash"}},
							},
						}, tc.migrationNamesParam)
				})
				require.NoError(t, err)
			})
		}
	}
}
