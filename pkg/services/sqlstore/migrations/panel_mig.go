package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addDashboardPanelMigrations(mg *Migrator) {
	mg.AddMigration("Add column panel_titles in dashboard", NewAddColumnMigration(DashboardV2, &Column{
		Name: "panel_titles", Type: DB_LongText, Length: 255, Nullable: true,
	}))

	mg.AddMigration("Add index for dashboard_panel_titles", NewAddIndexMigration(DashboardV2, &Index{
		Cols: []string{"panel_titles"},
		Type: IndexType,
	}))
}
