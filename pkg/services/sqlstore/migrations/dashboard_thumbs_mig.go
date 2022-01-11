package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardThumbsMigrations(mg *migrator.Migrator) {
	dashThumbs := migrator.Table{
		Name: "dashboard_thumbnail",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "dashboard_id", Type: migrator.DB_BigInt, Nullable: false},             // can join with dashboard table
			{Name: "panel_id", Type: migrator.DB_SmallInt, Nullable: false, Default: "0"}, // for panel thumbnails
			{Name: "image_data_url", Type: migrator.DB_Text, Nullable: false},             // data:image/png;base64,.... (can be used directly as image)
			{Name: "kind", Type: migrator.DB_NVarchar, Length: 8, Nullable: false},        // thumb | tall
			{Name: "theme", Type: migrator.DB_NVarchar, Length: 8, Nullable: false},       // light|dark
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"dashboard_id", "panel_id", "kind", "theme"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create dashboard_thumbnail table", migrator.NewAddTableMigration(dashThumbs))
	mg.AddMigration("add unique indexes for dashboard_thumbnail", migrator.NewAddIndexMigration(dashThumbs, dashThumbs.Indices[0]))
}
