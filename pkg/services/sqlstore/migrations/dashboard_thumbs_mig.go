package migrations

// This migration was run behind the `dashboardPreviews` flag.
// The feature flag and the whole dashboard previews feature was removed in https://github.com/grafana/grafana/pull/66176

//func addDashboardThumbsMigrations(mg *migrator.Migrator) {
//	dashThumbs := migrator.Table{
//		Name: "dashboard_thumbnail",
//		Columns: []*migrator.Column{
//			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
//			{Name: "dashboard_id", Type: migrator.DB_BigInt, Nullable: false},             // can join with dashboard table
//			{Name: "dashboard_version", Type: migrator.DB_Int, Nullable: false},           // screenshoted version of the dashboard
//			{Name: "state", Type: migrator.DB_NVarchar, Length: 10, Nullable: false},      // stale | locked
//			{Name: "panel_id", Type: migrator.DB_SmallInt, Nullable: false, Default: "0"}, // for panel thumbnails
//			{Name: "image", Type: migrator.DB_MediumBlob, Nullable: false},                // image stored as blob. MediumBlob has a max limit of 16mb in MySQL
//			{Name: "mime_type", Type: migrator.DB_NVarchar, Length: 255, Nullable: false}, // e.g. image/png, image/webp
//			{Name: "kind", Type: migrator.DB_NVarchar, Length: 8, Nullable: false},        // thumb | tall
//			{Name: "theme", Type: migrator.DB_NVarchar, Length: 8, Nullable: false},       // light|dark
//			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
//		},
//		Indices: []*migrator.Index{
//			{Cols: []string{"dashboard_id", "panel_id", "kind", "theme"}, Type: migrator.UniqueIndex},
//		},
//	}
//
//	mg.AddMigration("create dashboard_thumbnail table", migrator.NewAddTableMigration(dashThumbs))
//	mg.AddMigration("add unique indexes for dashboard_thumbnail", migrator.NewAddIndexMigration(dashThumbs, dashThumbs.Indices[0]))
//	mg.AddMigration("Add ds_uids column to dashboard_thumbnail table", migrator.NewAddColumnMigration(dashThumbs,
//		// uids of datasources used in the dashboard when taking preview
//		&migrator.Column{Name: "ds_uids", Type: migrator.DB_Text, Nullable: true, Default: ""},
//	))
//}
