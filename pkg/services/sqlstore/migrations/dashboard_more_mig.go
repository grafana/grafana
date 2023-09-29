package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardFolderMigrations(mg *migrator.Migrator) {
	mg.AddMigration("Add folder_uid for dashboard", migrator.NewAddColumnMigration(dashboardV2, &migrator.Column{
		Name: "folder_uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: true,
	}))

	mg.AddMigration("Add unique index for dashboard_org_id_folder_uid_title", migrator.NewAddIndexMigration(dashboardV2, &migrator.Index{
		Cols: []string{"org_id", "folder_uid", "title"}, Type: migrator.UniqueIndex,
	}))

	mg.AddMigration("Drop unique index for dashboard_org_id_title_folder_id", migrator.NewDropIndexMigration(dashboardV2, &migrator.Index{
		Cols: []string{"org_id", "folder_id", "title"}, Type: migrator.UniqueIndex,
	}))
}
