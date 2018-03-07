package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addPreferencesMigrations(mg *Migrator) {

	mg.AddMigration("drop preferences table v2", NewDropTableMigration("preferences"))

	preferencesV2 := Table{
		Name: "preferences",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "home_dashboard_id", Type: DB_BigInt, Nullable: false},
			{Name: "timezone", Type: DB_NVarchar, Length: 50, Nullable: false},
			{Name: "theme", Type: DB_NVarchar, Length: 20, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"user_id"}},
		},
	}

	mg.AddMigration("drop preferences table v3", NewDropTableMigration("preferences"))

	// create table
	mg.AddMigration("create preferences table v3", NewAddTableMigration(preferencesV2))

	mg.AddMigration("Update preferences table charset", NewTableCharsetMigration("preferences", []*Column{
		{Name: "timezone", Type: DB_NVarchar, Length: 50, Nullable: false},
		{Name: "theme", Type: DB_NVarchar, Length: 20, Nullable: false},
	}))
}
