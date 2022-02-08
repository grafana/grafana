package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardSearchMigration(mg *Migrator) {
	dashboardSearchV1 := Table{
		Name: "dashboard_search",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},     // avoid UID since also requires orgID!
			{Name: "panel_id", Type: DB_Int, Nullable: false},            // zero is dashboard level
			{Name: "key", Type: DB_Varchar, Length: 20, Nullable: false}, // title, datasource
			{Name: "value", Type: DB_Text, Nullable: false},              // full text index?
		},
		Indices: []*Index{
			{Cols: []string{"dashboard_id"}},
			{Cols: []string{"key"}},
			{Cols: []string{"dashboard_id", "panel_id", "key"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create dashboard_search table", NewAddTableMigration(dashboardSearchV1))
}
