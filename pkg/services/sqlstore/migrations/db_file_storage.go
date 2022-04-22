package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// TODO: remove nolint as part of https://github.com/grafana/grafana/issues/45498
// nolint:unused,deadcode
func addDbFileStorageMigration(mg *migrator.Migrator) {
	filesTable := migrator.Table{
		Name: "file",
		Columns: []*migrator.Column{
			{Name: "path", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "path_hash", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "parent_folder_path_hash", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "contents", Type: migrator.DB_Blob, Nullable: false},
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
			{Name: "path_hash", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "key", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "value", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"path_hash", "key"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create file_meta table", migrator.NewAddTableMigration(fileMetaTable))
	mg.AddMigration("file table idx: path key", migrator.NewAddIndexMigration(fileMetaTable, fileMetaTable.Indices[0]))
}
