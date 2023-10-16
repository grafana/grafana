package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardFolderMigrations(mg *migrator.Migrator) {
	mg.AddMigration("Add folder_uid for dashboard", migrator.NewAddColumnMigration(migrator.Table{Name: "dashboard"}, &migrator.Column{
		Name: "folder_uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false, Default: "0",
	}))

	mg.AddMigration("Add unique index for dashboard_org_id_folder_uid_title", migrator.NewAddIndexMigration(migrator.Table{Name: "dashboard"}, &migrator.Index{
		Cols: []string{"org_id", "folder_uid", "title"}, Type: migrator.UniqueIndex,
	}))
}
