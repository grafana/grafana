package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardVisitMigration(mg *Migrator) {
	dashboardVisitV1 := Table{
		Name: "dashboard_visit",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "visited_at", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"user_id"}},
			{Cols: []string{"dashboard_id"}},
		},
	}

	mg.AddMigration("create dashboard_visit table", NewAddTableMigration(dashboardVisitV1))
}
