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
}
