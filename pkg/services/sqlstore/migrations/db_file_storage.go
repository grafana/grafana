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

	addDeleteAutoGenIDsFileMigration(mg)
	addFilePrimaryKeyMigration(mg)
}

func addFilePrimaryKeyMigration(mg *migrator.Migrator) {
	// Add primary key to file table on path_hash column
	// This converts the existing unique constraint to a primary key
	// Only run if the unique index exists (which means the table exists but doesn't have primary key)
	migration := migrator.NewRawSQLMigration("").
		Mysql(`
			ALTER TABLE file 
			DROP INDEX UQE_file_path_hash,
			ADD PRIMARY KEY (path_hash);
		`).
		Postgres(`
			DO $$
			BEGIN
				-- Drop the unique constraint if it exists
				IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQE_file_path_hash') THEN
					ALTER TABLE file DROP CONSTRAINT UQE_file_path_hash;
				END IF;
				
				-- Add primary key
				ALTER TABLE file ADD PRIMARY KEY (path_hash);
			END $$;
		`).
		SQLite(`
			-- For SQLite we need to recreate the table with primary key
			CREATE TABLE file_new (
				path varchar(1024) NOT NULL,
				path_hash varchar(64) NOT NULL,
				parent_folder_path_hash varchar(64) NOT NULL,
				contents blob,
				etag varchar(32) NOT NULL,
				cache_control varchar(128) NOT NULL,
				content_disposition varchar(128) NOT NULL,
				updated datetime NOT NULL,
				created datetime NOT NULL,
				size bigint NOT NULL,
				mime_type varchar(255) NOT NULL,
				PRIMARY KEY (path_hash)
			);
			INSERT INTO file_new SELECT path, path_hash, parent_folder_path_hash, contents, etag, cache_control, content_disposition, updated, created, size, mime_type FROM file;
			DROP TABLE file;
			ALTER TABLE file_new RENAME TO file;
			
			-- Recreate the parent_folder_path_hash index
			CREATE INDEX IDX_file_parent_folder_path_hash ON file (parent_folder_path_hash);
		`).
		Mssql(`
			-- For MSSQL, drop the unique constraint and add primary key
			IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQE_file_path_hash')
			BEGIN
				DROP INDEX UQE_file_path_hash ON file;
			END
			
			ALTER TABLE file ADD CONSTRAINT PK_file_path_hash PRIMARY KEY (path_hash);
		`)

	mg.AddMigration("add primary key to file table", migration)
}

func addDeleteAutoGenIDsFileMigration(mg *migrator.Migrator) {
	// Check if delete_auto_gen_ids is enabled in the configuration
	if mg.Cfg == nil || mg.Cfg.Raw == nil {
		return
	}

	deleteAutoGenIDs := mg.Cfg.Raw.Section("database").Key("delete_auto_gen_ids").MustBool(false)
	if !deleteAutoGenIDs {
		return
	}

	// Run the migration to drop the auto-generated primary key
	migration := migrator.NewRawSQLMigration("").
		Mysql(`
			-- Drop the auto-generated my_row_id primary key
			ALTER TABLE file DROP PRIMARY KEY;
		`).
		Postgres(`
			-- Auto-generated primary keys are a MySQL feature, so we don't need to do anything for Postgres
		`).
		SQLite(`
			-- SQLite doesn't have auto-generated primary keys
		`).
		Mssql(`
			-- MSSQL doesn't have auto-generated primary keys like Azure MySQL
		`)

	mg.AddMigration("drop auto-generated primary key from file table", migration)
}
