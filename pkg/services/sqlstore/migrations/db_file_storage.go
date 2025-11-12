package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDbFileStorageMigration(mg *migrator.Migrator) {
	filesTable := migrator.Table{
		Name: "file",
		Columns: []*migrator.Column{
			{Name: "path", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},

			// path_hash is used for indexing. we are using it to circumvent the max length limit of 191 for varchar2 fields in MySQL 5.6
			{Name: "path_hash", Type: migrator.DB_NVarchar, Length: 64, Nullable: false},

			// parent_folder_path_hash is an optimization for a common use case - list all files in a given folder
			{Name: "parent_folder_path_hash", Type: migrator.DB_NVarchar, Length: 64, Nullable: false},

			{Name: "contents", Type: migrator.DB_Blob, Nullable: false},

			// HTTP Entity tag; md5 hash
			{Name: "etag", Type: migrator.DB_NVarchar, Length: 32, Nullable: false},

			// cache_control HTTP header
			// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
			{Name: "cache_control", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},

			// content_disposition HTTP header - inline/attachment file display
			// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
			{Name: "content_disposition", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},

			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "size", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "mime_type", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"path_hash"}, Type: migrator.UniqueIndex},
			{Cols: []string{"parent_folder_path_hash"}},
		},
	}

	mg.AddMigration("create file table", migrator.NewAddTableMigration(filesTable))
	mg.AddMigration("file table idx: path natural pk", migrator.NewAddIndexMigration(filesTable, filesTable.Indices[0]))
	mg.AddMigration("file table idx: parent_folder_path_hash fast folder retrieval", migrator.NewAddIndexMigration(filesTable, filesTable.Indices[1]))

	fileMetaTable := migrator.Table{
		Name: "file_meta",
		Columns: []*migrator.Column{
			{Name: "path_hash", Type: migrator.DB_NVarchar, Length: 64, Nullable: false},

			// 191 is the maximum length of indexable VARCHAR fields in MySQL 5.6 <= with utf8mb4 encoding
			{Name: "key", Type: migrator.DB_NVarchar, Length: 191, Nullable: false},
			{Name: "value", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"path_hash", "key"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create file_meta table", migrator.NewAddTableMigration(fileMetaTable))
	mg.AddMigration("file table idx: path key", migrator.NewAddIndexMigration(fileMetaTable, fileMetaTable.Indices[0]))

	// TODO: add collation support to `migrator.Column`
	mg.AddMigration("set path collation in file table", migrator.NewRawSQLMigration("").
		// MySQL `utf8mb4_unicode_ci` collation is set in `mysql_dialect.go`
		// SQLite uses a `BINARY` collation by default
		Postgres("ALTER TABLE file ALTER COLUMN path TYPE VARCHAR(1024) COLLATE \"C\";")) // Collate C - sorting done based on character code byte values

	mg.AddMigration("migrate contents column to mediumblob for MySQL", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE file MODIFY contents MEDIUMBLOB;"))

	convertFilePathHashIndexToPrimaryKey(mg)
	convertFileMetaPathHashKeyIndexToPrimaryKey(mg)
}

// This converts the existing unique constraint UQE_file_path_hash to a primary key in file table
func convertFilePathHashIndexToPrimaryKey(mg *migrator.Migrator) {
	// migration 1 is to handle cases where the table was created with sql_generate_invisible_primary_key = ON
	// in this case we need to do everything in one sql statement
	mysqlMigration1 := migrator.NewRawSQLMigration("").Mysql(`
	  ALTER TABLE file
	  DROP PRIMARY KEY,
	  DROP COLUMN my_row_id,
	  DROP INDEX UQE_file_path_hash,
	  ADD PRIMARY KEY (path_hash);
	`)
	mysqlMigration1.Condition = &migrator.IfColumnExistsCondition{TableName: "file", ColumnName: "my_row_id"}
	mg.AddMigration("drop my_row_id and add primary key to file table if my_row_id exists (auto-generated mysql column)", mysqlMigration1)

	mysqlMigration2 := migrator.NewRawSQLMigration("").Mysql(`ALTER TABLE file DROP INDEX UQE_file_path_hash`)
	mysqlMigration2.Condition = &migrator.IfIndexExistsCondition{TableName: "file", IndexName: "UQE_file_path_hash"}
	mg.AddMigration("drop file_path unique index from file table if it exists (mysql)", mysqlMigration2)

	mysqlMigration3 := migrator.NewRawSQLMigration("").Mysql(`ALTER TABLE file ADD PRIMARY KEY (path_hash);`)
	mysqlMigration3.Condition = &migrator.IfPrimaryKeyNotExistsCondition{TableName: "file", ColumnName: "path_hash"}
	mg.AddMigration("add primary key to file table if it doesn't exist (mysql)", mysqlMigration3)

	postgres := `
		DO $$
		BEGIN
			-- Drop the unique constraint if it exists
			DROP INDEX IF EXISTS "UQE_file_path_hash";

			-- Add primary key if it doesn't already exist
			IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE indrelid = 'file'::regclass AND indisprimary) THEN
				ALTER TABLE file ADD PRIMARY KEY (path_hash);
			END IF;
		END $$;
	`

	sqlite := `
		-- For SQLite we need to recreate the table with primary key. CREATE TABLE was generated by ".schema file" command after running migration.
		CREATE TABLE file_new
		(
			path                    TEXT     NOT NULL,
			path_hash               TEXT     NOT NULL,
			parent_folder_path_hash TEXT     NOT NULL,
			contents                BLOB     NOT NULL,
			etag                    TEXT     NOT NULL,
			cache_control           TEXT     NOT NULL,
			content_disposition     TEXT     NOT NULL,
			updated                 DATETIME NOT NULL,
			created                 DATETIME NOT NULL,
			size                    INTEGER  NOT NULL,
			mime_type               TEXT     NOT NULL,

			PRIMARY KEY (path_hash)
		);

		INSERT INTO file_new (path, path_hash, parent_folder_path_hash, contents, etag, cache_control, content_disposition, updated, created, size, mime_type)
		SELECT path, path_hash, parent_folder_path_hash, contents, etag, cache_control, content_disposition, updated, created, size, mime_type FROM file;

		DROP TABLE file;
		ALTER TABLE file_new RENAME TO file;

		CREATE INDEX IDX_file_parent_folder_path_hash ON file (parent_folder_path_hash);
	`

	// postgres and sqlite statements are idempotent so we can have only one condition-less migration
	migration := migrator.NewRawSQLMigration("").
		Postgres(postgres).
		SQLite(sqlite)

	mg.AddMigration("add primary key to file table (postgres and sqlite)", migration)
}

// This converts the existing unique constraint UQE_file_meta_path_hash_key to a primary key in file_meta table
func convertFileMetaPathHashKeyIndexToPrimaryKey(mg *migrator.Migrator) {
	// migration 1 is to handle cases where the table was created with sql_generate_invisible_primary_key = ON
	// in this case we need to do everything in one sql statement
	mysqlMigration1 := migrator.NewRawSQLMigration("").Mysql(`
	  ALTER TABLE file_meta
      DROP PRIMARY KEY,
      DROP COLUMN my_row_id,
      DROP INDEX UQE_file_meta_path_hash_key,
      ADD PRIMARY KEY (path_hash, ` + "`key`" + `);
	`)
	mysqlMigration1.Condition = &migrator.IfColumnExistsCondition{TableName: "file_meta", ColumnName: "my_row_id"}
	mg.AddMigration("drop my_row_id and add primary key to file_meta table if my_row_id exists (auto-generated mysql column)", mysqlMigration1)

	mysqlMigration2 := migrator.NewRawSQLMigration("").Mysql(`ALTER TABLE file_meta DROP INDEX UQE_file_meta_path_hash_key`)
	mysqlMigration2.Condition = &migrator.IfIndexExistsCondition{TableName: "file_meta", IndexName: "UQE_file_meta_path_hash_key"}
	mg.AddMigration("drop file_path unique index from file_meta table if it exists (mysql)", mysqlMigration2)

	mysqlMigration3 := migrator.NewRawSQLMigration("").Mysql(`ALTER TABLE file_meta ADD PRIMARY KEY (path_hash, ` + "`key`" + `);`)
	mysqlMigration3.Condition = &migrator.IfPrimaryKeyNotExistsCondition{TableName: "file_meta", ColumnName: "path_hash"}
	mg.AddMigration("add primary key to file_meta table if it doesn't exist (mysql)", mysqlMigration3)

	postgres := `
		DO $$
		BEGIN
			-- Drop the unique constraint if it exists
			DROP INDEX IF EXISTS "UQE_file_meta_path_hash_key";

			-- Add primary key if it doesn't already exist
			IF NOT EXISTS (SELECT 1 FROM pg_index i WHERE indrelid = 'file_meta'::regclass AND indisprimary) THEN
				ALTER TABLE file_meta ADD PRIMARY KEY (path_hash, ` + "`key`" + `);
			END IF;
		END $$;
	`

	sqlite := `
		-- For SQLite we need to recreate the table with primary key. CREATE TABLE was generated by ".schema file_meta" command after running migration.
		CREATE TABLE file_meta_new
		(
			path_hash TEXT NOT NULL,
			key       TEXT NOT NULL,
			value     TEXT NOT NULL,

			PRIMARY KEY (path_hash, key)
		);

		INSERT INTO file_meta_new (path_hash, key, value)
		SELECT path_hash, key, value FROM file_meta;

		DROP TABLE file_meta;
		ALTER TABLE file_meta_new RENAME TO file_meta;
	`

	// postgres and sqlite statements are idempotent so we can have only one condition-less migration
	migration := migrator.NewRawSQLMigration("").
		Postgres(postgres).
		SQLite(sqlite)

	mg.AddMigration("add primary key to file_meta table (postgres and sqlite)", migration)
}
