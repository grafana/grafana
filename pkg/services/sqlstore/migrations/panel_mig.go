package migrations

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addDashboardPanelMigrations(mg *migrator.Migrator) {
	mg.AddMigration("Add column panel_titles in dashboard", migrator.NewRawSQLMigration("").
		SQLite("ALTER TABLE dashboard ADD panel_titles TEXT;").
		Postgres(`ALTER TABLE dashboard ADD COLUMN panel_titles tsvector;`).
		Mysql("ALTER TABLE dashboard ADD FULLTEXT(panel_titles);"))
}
