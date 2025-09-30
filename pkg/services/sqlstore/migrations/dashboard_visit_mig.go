package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardVisitMigrations(mg *Migrator) {
	userResourcesVisitStatsV1 := Table{
		Name: "user_resources_visit_stats",
		Columns: []*Column{
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "resource_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "resource_type", Type: DB_NVarchar, Length: 20, Nullable: false}, // 'dashboard', 'folder', 'alert'
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "visit_count", Type: DB_Int, Nullable: false, Default: "1"},
			{Name: "last_visited", Type: DB_DateTime, Nullable: false},
			{Name: "first_visited", Type: DB_DateTime, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"user_id", "resource_uid", "resource_type", "org_id"}, Type: UniqueIndex},
			{Cols: []string{"user_id", "org_id", "resource_type", "visit_count"}},
			{Cols: []string{"resource_uid", "resource_type", "org_id"}},
			{Cols: []string{"org_id", "resource_type", "last_visited"}},
			{Cols: []string{"user_id", "resource_type", "last_visited"}},
			{Cols: []string{"resource_type"}},
		},
	}

	mg.AddMigration("create user_resources_visit_stats table", NewAddTableMigration(userResourcesVisitStatsV1))
	addTableIndicesMigrations(mg, "v1", userResourcesVisitStatsV1)
}
