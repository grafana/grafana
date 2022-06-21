package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addPublicDashboardMigration(mg *Migrator) {
	var dashboardPublicCfgV1 = Table{
		Name: "dashboard_public_config",
		Columns: []*Column{
			{Name: "uid", Type: DB_NVarchar, Length: 40, IsPrimaryKey: true},
			{Name: "dashboard_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "time_settings", Type: DB_Text, Nullable: false},
			{Name: "refresh_rate", Type: DB_Int, Nullable: false, Default: "30"},
			{Name: "template_variables", Type: DB_MediumText, Nullable: true},
		},
		Indices: []*Index{
			{Cols: []string{"uid"}, Type: UniqueIndex},
			{Cols: []string{"org_id", "dashboard_uid"}},
		},
	}
	mg.AddMigration("create dashboard public config v1", NewAddTableMigration(dashboardPublicCfgV1))

	// table has no dependencies and was created with incorrect pkey type.
	// drop then recreate with correct values
	addDropAllIndicesMigrations(mg, "v1", dashboardPublicCfgV1)
	mg.AddMigration("Drop old dashboard public config table", NewDropTableMigration("dashboard_public_config"))

	// recreate table with proper primary key type
	mg.AddMigration("recreate dashboard public config v1", NewAddTableMigration(dashboardPublicCfgV1))
	addTableIndicesMigrations(mg, "v1", dashboardPublicCfgV1)
}
