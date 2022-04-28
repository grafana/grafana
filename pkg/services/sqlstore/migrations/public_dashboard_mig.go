package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addPublicDashboardMigration(mg *Migrator) {
	var publicDashboardV1 = Table{
		Name: "public_dashboard",
		Columns: []*Column{
			{Name: "uid", Type: DB_BigInt, IsPrimaryKey: true},
			{Name: "dashboard_uid", Type: DB_NVarchar, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "refresh_rate", Type: DB_Int, Nullable: false, Default: "30"},
			{Name: "template_variables", Type: DB_MediumText, Nullable: true},
			{Name: "time_variables", Type: DB_Text, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"uid"}, Type: UniqueIndex},
			{Cols: []string{"org_id", "dashboard_uid"}},
		},
	}

	mg.AddMigration("create public dashboard v1", NewAddTableMigration(publicDashboardV1))
	addTableIndicesMigrations(mg, "v1", publicDashboardV1)
}
