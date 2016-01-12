package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addAppSettingsMigration(mg *Migrator) {

	appSettingsV1 := Table{
		Name: "app_settings",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: true},
			{Name: "app_id", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "enabled", Type: DB_Bool, Nullable: false},
			{Name: "pinned", Type: DB_Bool, Nullable: false},
			{Name: "json_data", Type: DB_Text, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "app_id"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create app_settings table v1", NewAddTableMigration(appSettingsV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v3", appSettingsV1)
}
