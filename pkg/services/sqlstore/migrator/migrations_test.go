package migrator

import (
	_ "embed"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type ExpectedMigration struct {
	Id  string
	SQL string
}

//go:embed testdata/sqlite_file_migration_statement.sql
var sqliteMigrationStatement string

func TestConvertUniqueKeyToPrimaryKey(t *testing.T) {
	expectedMigrations := map[string][]ExpectedMigration{
		MySQL: {
			{Id: "drop my_row_id and add primary key to file table if my_row_id exists (auto-generated mysql column)", SQL: `
			  ALTER TABLE file
			  DROP PRIMARY KEY,
			  DROP COLUMN my_row_id,
			  DROP INDEX UQE_file_path_hash,
			  ADD PRIMARY KEY (path_hash);
			`},
			{Id: "drop UQE_file_path_hash unique index from file table if it exists (mysql)", SQL: "ALTER TABLE file DROP INDEX UQE_file_path_hash"},
			{Id: "add primary key to file table if it doesn't exist (mysql)", SQL: "ALTER TABLE file ADD PRIMARY KEY (path_hash)"},
			{Id: "add primary key to file table (postgres and sqlite)", SQL: ""},
		},
		Postgres: {
			{Id: "drop my_row_id and add primary key to file table if my_row_id exists (auto-generated mysql column)", SQL: ""},
			{Id: "drop UQE_file_path_hash unique index from file table if it exists (mysql)", SQL: ""},
			{Id: "add primary key to file table if it doesn't exist (mysql)", SQL: ""},
			{Id: "add primary key to file table (postgres and sqlite)", SQL: `
				DO $$
				BEGIN
					-- Drop the unique constraint if it exists
					DROP INDEX IF EXISTS "UQE_file_path_hash";

					-- Add primary key if it doesn't already exist
					IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE indrelid = 'file'::regclass AND indisprimary) THEN
					ALTER TABLE file ADD PRIMARY KEY (path_hash);
				END IF;
				END $$;`},
		},
		SQLite: {
			{Id: "drop my_row_id and add primary key to file table if my_row_id exists (auto-generated mysql column)", SQL: ""},
			{Id: "drop UQE_file_path_hash unique index from file table if it exists (mysql)", SQL: ""},
			{Id: "add primary key to file table if it doesn't exist (mysql)", SQL: ""},
			{Id: "add primary key to file table (postgres and sqlite)", SQL: sqliteMigrationStatement}, // Embed used here because sqlite statement is full of backquotes.
		},
	}

	for dialectName, migrations := range expectedMigrations {
		CheckExpectedMigrations(t, dialectName, migrations, func(migrator *Migrator) {
			ConvertUniqueKeyToPrimaryKey(migrator,
				"file",
				Index{Cols: []string{"path_hash"}, Type: UniqueIndex}, // Convert this unique key to primary key
				Table{
					Name: "file",
					Columns: []*Column{
						{Name: "path", Type: DB_NVarchar, Length: 1024, Nullable: false},
						{Name: "path_hash", Type: DB_NVarchar, Length: 64, Nullable: false, IsPrimaryKey: true},
						{Name: "parent_folder_path_hash", Type: DB_NVarchar, Length: 64, Nullable: false},
						{Name: "contents", Type: DB_Blob, Nullable: false},
						{Name: "etag", Type: DB_NVarchar, Length: 32, Nullable: false},
						{Name: "cache_control", Type: DB_NVarchar, Length: 128, Nullable: false},
						{Name: "content_disposition", Type: DB_NVarchar, Length: 128, Nullable: false},
						{Name: "updated", Type: DB_DateTime, Nullable: false},
						{Name: "created", Type: DB_DateTime, Nullable: false},
						{Name: "size", Type: DB_BigInt, Nullable: false},
						{Name: "mime_type", Type: DB_NVarchar, Length: 255, Nullable: false},
					},
					PrimaryKeys: []string{"path_hash"},
					Indices: []*Index{
						{Cols: []string{"parent_folder_path_hash"}},
					},
				})
		})
	}
}

func CheckExpectedMigrations(t *testing.T, dialectName string, expected []ExpectedMigration, addMigrations func(migrator *Migrator)) {
	d := NewDialect(dialectName)
	mg := newMigrator(nil, nil, "", d)
	addMigrations(mg)

	require.Len(t, mg.migrations, len(expected))

	for ix, m := range mg.migrations {
		assert.Equal(t, expected[ix].Id, m.Id())
		assert.Equal(t, normalizeLines(expected[ix].SQL), normalizeLines(m.SQL(d)))
	}
}

func normalizeLines(sql string) string {
	lines := strings.Split(sql, "\n")
	result := strings.Builder{}
	for _, l := range lines {
		l := strings.TrimSpace(l)
		if l == "" {
			continue
		}
		result.WriteString(l)
		result.WriteString("\n")
	}
	return result.String()
}
