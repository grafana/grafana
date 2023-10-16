package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardFolderMigrations(mg *migrator.Migrator) {
	mg.AddMigration("Add folder_uid for dashboard", migrator.NewAddColumnMigration(migrator.Table{Name: "dashboard"}, &migrator.Column{
		Name: "folder_uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false, Default: "0",
	}))
}
