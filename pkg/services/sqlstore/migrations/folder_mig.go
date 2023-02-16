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
