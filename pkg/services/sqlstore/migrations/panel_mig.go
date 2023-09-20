package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addDashboardPanelMigrations(mg *Migrator) {
	mg.AddMigration("Add column panel_titles in dashboard", NewAddColumnMigration(DashboardV2, &Column{
		Name: "panel_titles", Type: DB_NVarchar, Length: 255, Nullable: true, Default: "",
	}))
}
