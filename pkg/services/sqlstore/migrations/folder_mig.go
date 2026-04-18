package migrations

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addFolderMigrations(mg *migrator.Migrator) {
	mg.AddMigration("create folder table", migrator.NewAddTableMigration(folderv1()))

	mg.AddMigration("Add index for parent_uid", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Cols: []string{"parent_uid", "org_id"},
	}))

	mg.AddMigration("Add unique index for folder.uid and folder.org_id", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"uid", "org_id"},
	}))

	mg.AddMigration("Update folder title length", migrator.NewTableCharsetMigration("folder", []*migrator.Column{
		// it should be lower than 191 (the maximum length of indexable VARCHAR fields in MySQL 5.6 <= with utf8mb4 encoding)
		// but the title column length of the dashboard table whose values are copied into this column is 189
		{Name: "title", Type: migrator.DB_NVarchar, Length: 189, Nullable: false},
	}))

	mg.AddMigration("Add unique index for folder.title and folder.parent_uid", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"title", "parent_uid"},
	}))
	mg.AddMigration("Remove unique index for folder.title and folder.parent_uid", migrator.NewDropIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"title", "parent_uid"},
	}))

	mg.AddMigration("Add unique index for title, parent_uid, and org_id", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"title", "parent_uid", "org_id"},
	}))

	mg.AddMigration("Sync dashboard and folder table", migrator.NewRawSQLMigration("").
		Mysql(`
			INSERT INTO folder (uid, org_id, title, created, updated)
			SELECT * FROM (SELECT uid, org_id, title, created, updated FROM dashboard WHERE is_folder = 1) AS derived
			ON DUPLICATE KEY UPDATE title=derived.title, updated=derived.updated
		`).Postgres(`
			INSERT INTO folder (uid, org_id, title, created, updated)
			SELECT uid, org_id, title, created, updated FROM dashboard WHERE is_folder = true
			ON CONFLICT(uid, org_id) DO UPDATE SET title=excluded.title, updated=excluded.updated
		`).SQLite(`
			INSERT INTO folder (uid, org_id, title, created, updated)
			SELECT uid, org_id, title, created, updated FROM dashboard WHERE is_folder = 1
			ON CONFLICT DO UPDATE SET title=excluded.title, updated=excluded.updated
		`))

	mg.AddMigration("Remove ghost folders from the folder table", migrator.NewRawSQLMigration(`
			DELETE FROM folder WHERE NOT EXISTS
				(SELECT 1 FROM dashboard WHERE dashboard.uid = folder.uid AND dashboard.org_id = folder.org_id AND dashboard.is_folder = true)
	`))

	mg.AddMigration("Remove unique index UQE_folder_uid_org_id", migrator.NewDropIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"uid", "org_id"},
	}))

	mg.AddMigration("Add unique index UQE_folder_org_id_uid", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"org_id", "uid"},
	}))

	mg.AddMigration("Remove unique index UQE_folder_title_parent_uid_org_id", migrator.NewDropIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"title", "parent_uid", "org_id"},
	}))

	mg.AddMigration("Add unique index UQE_folder_org_id_parent_uid_title", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"org_id", "parent_uid", "title"},
	}))

	// No need to introduce IDX_folder_org_id_parent_uid because is covered by UQE_folder_org_id_parent_uid_title
	mg.AddMigration("Remove index IDX_folder_parent_uid_org_id", migrator.NewDropIndexMigration(folderv1(), &migrator.Index{
		Cols: []string{"parent_uid", "org_id"},
	}))

	// Remove the unique name constraint
	mg.AddMigration("Remove unique index UQE_folder_org_id_parent_uid_title", migrator.NewDropIndexMigration(folderv1(), &migrator.Index{
		Type: migrator.UniqueIndex,
		Cols: []string{"org_id", "parent_uid", "title"},
	}))

	mg.AddMigration("Add index IDX_folder_org_id_parent_uid", migrator.NewAddIndexMigration(folderv1(), &migrator.Index{
		Name: "IDX_folder_org_id_parent_uid",
		Cols: []string{"org_id", "parent_uid"},
	}))
}

func folderv1() migrator.Table {
	// Do not make any changes to this schema; introduce new migrations for further changes
	return migrator.Table{
		Name: "folder",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "title", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "description", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "parent_uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: true},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
	}
}
