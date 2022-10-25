package migrations

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// nolint:unused // this is temporarily unused during feature development
func addFolderMigrations(mg *migrator.Migrator) {
	mg.AddMigration("create folder table", migrator.NewAddTableMigration(folderv1()))

	// copy any existing folders in the dashboard table into the new folder
	// table. The *legacy* parent folder ID, stored as folder_id  in the
	// dashboard table, is always going to be "0" so it is safe to convert to a parent UID.
	mg.AddMigration("copy existing folders from dashboard table", migrator.NewRawSQLMigration(
		"INSERT INTO folder (id, uid, org_id, title, parent_uid, created, updated) SELECT id, uid, org_id, title, folder_id, created, updated FROM dashboard WHERE is_folder = 1;",
	).Postgres("INSERT INTO folder (id, uid, org_id, title, parent_uid, created, updated) SELECT id, uid, org_id, title, folder_id, created, updated FROM dashboard WHERE is_folder = true;"))

	mg.AddMigration("Add index for parent_uid", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Cols: []string{"parent_uid", "org_id"},
	}))
}

// nolint:unused // this is temporarily unused during feature development
func folderv1() migrator.Table {
	return migrator.Table{
		Name: "folder",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "description", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "parent_uid", Type: migrator.DB_NVarchar, Length: 40},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
	}
}
