package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addNavbarPreferencesMigrations(mg *Migrator) {
	navbar := Table{
		Name: "navbar_preferences",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "nav_item_id", Type: DB_NVarchar, Length: 50, Nullable: false},
			{Name: "hide_from_navbar", Type: DB_Bool, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"user_id"}},
		},
	}

	// create table
	mg.AddMigration("create navbar preferences table", NewAddTableMigration(navbar))
}
