package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addAppPluginMigration(mg *Migrator) {

	var appPluginV1 = Table{
		Name: "app_plugin",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: true},
			{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "enabled", Type: DB_Bool, Nullable: false},
			{Name: "json_data", Type: DB_Text, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "type"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create app_plugin table v1", NewAddTableMigration(appPluginV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", appPluginV1)
}
