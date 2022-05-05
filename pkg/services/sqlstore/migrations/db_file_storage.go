package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// TODO: remove nolint as part of https://github.com/grafana/grafana/issues/45498
// nolint:unused,deadcode
func addDbFileStorageMigration(mg *migrator.Migrator) {
	filesTable := migrator.Table{
		Name: "file",
		Columns: []*migrator.Column{
			{Name: "path", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "parent_folder_path", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "contents", Type: migrator.DB_Blob, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "size", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "mime_type", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"path"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create file table", migrator.NewAddTableMigration(filesTable))
	mg.AddMigration("file table idx: path natural pk", migrator.NewAddIndexMigration(filesTable, filesTable.Indices[0]))

	fileMetaTable := migrator.Table{
		Name: "file_meta",
		Columns: []*migrator.Column{
			{Name: "path", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "key", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "value", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"path", "key"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create file_meta table", migrator.NewAddTableMigration(fileMetaTable))
	mg.AddMigration("file table idx: path key", migrator.NewAddIndexMigration(fileMetaTable, fileMetaTable.Indices[0]))
}
