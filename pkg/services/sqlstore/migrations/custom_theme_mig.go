package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addCustomThemeMigrations(mg *Migrator) {
	customThemeTable := Table{
		Name: "custom_theme",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "theme_json", Type: DB_MediumText, Nullable: false},
			{Name: "user_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "is_global", Type: DB_Bool, Nullable: false, Default: "0"},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "uid"}, Type: UniqueIndex},
			{Cols: []string{"org_id", "user_uid"}},
			{Cols: []string{"org_id", "is_global"}},
		},
	}

	mg.AddMigration("create custom_theme table", NewAddTableMigration(customThemeTable))
	mg.AddMigration("add unique index custom_theme.org_id_uid", NewAddIndexMigration(customThemeTable, customThemeTable.Indices[0]))
	mg.AddMigration("add index custom_theme.org_id_user_uid", NewAddIndexMigration(customThemeTable, customThemeTable.Indices[1]))
	mg.AddMigration("add index custom_theme.org_id_is_global", NewAddIndexMigration(customThemeTable, customThemeTable.Indices[2]))
}
