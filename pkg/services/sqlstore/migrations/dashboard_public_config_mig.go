package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addPublicDashboardMigration(mg *Migrator) {
	var dashboardPublicCfgV1 = Table{
		Name: "dashboard_public_config",
		Columns: []*Column{
			{Name: "uid", Type: DB_NVarchar, IsPrimaryKey: true},
			{Name: "dashboard_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "template_variables", Type: DB_MediumText, Nullable: true},
			{Name: "time_variables", Type: DB_Text, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"uid"}, Type: UniqueIndex},
			{Cols: []string{"org_id", "dashboard_uid"}},
		},
	}

	mg.AddMigration("create dashboard public config v1", NewAddTableMigration(dashboardPublicCfgV1))
	addTableIndicesMigrations(mg, "v1", dashboardPublicCfgV1)
}
