package migrations

import . "github.com/wangy1931/grafana/pkg/services/sqlstore/migrator"

func addPreferencesMigrations(mg *Migrator) {

	mg.AddMigration("drop preferences table v2", NewDropTableMigration("preferences"))

	preferencesV2 := Table{
		Name: "preferences",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_Int, Nullable: true},
			{Name: "user_id", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "home_dashboard_id", Type: DB_BigInt, Nullable: true},
			{Name: "timezone", Type: DB_NVarchar, Length: 50, Nullable: true},
			{Name: "theme", Type: DB_NVarchar, Length: 20, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"user_id"}},
		},
	}

	// create table
	mg.AddMigration("create preferences table v2", NewAddTableMigration(preferencesV2))
}
