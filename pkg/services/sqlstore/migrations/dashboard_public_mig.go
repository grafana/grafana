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

	var dashboardPublicCfgV2 = Table{
		Name: "dashboard_public_config",
		Columns: []*Column{
			{Name: "uid", Type: DB_NVarchar, Length: 40, IsPrimaryKey: true},
			{Name: "dashboard_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},

			{Name: "time_settings", Type: DB_Text, Nullable: true},
			{Name: "template_variables", Type: DB_MediumText, Nullable: true},

			{Name: "access_token", Type: DB_NVarchar, Length: 32, Nullable: false},

			{Name: "created_by", Type: DB_Int, Nullable: false},
			{Name: "updated_by", Type: DB_Int, Nullable: true},

			{Name: "created_at", Type: DB_DateTime, Nullable: false},
			{Name: "updated_at", Type: DB_DateTime, Nullable: true},

			{Name: "is_enabled", Type: DB_Bool, Nullable: false, Default: "0"},
		},
		Indices: []*Index{
			{Cols: []string{"uid"}, Type: UniqueIndex},
			{Cols: []string{"org_id", "dashboard_uid"}},
			{Cols: []string{"access_token"}, Type: UniqueIndex},
		},
	}

	// initial create table
	mg.AddMigration("create dashboard public config v1", NewAddTableMigration(dashboardPublicCfgV1))

	// recreate table - no dependencies and was created with incorrect pkey type
	addDropAllIndicesMigrations(mg, "v1", dashboardPublicCfgV1)
	mg.AddMigration("Drop old dashboard public config table", NewDropTableMigration("dashboard_public_config"))
	mg.AddMigration("recreate dashboard public config v1", NewAddTableMigration(dashboardPublicCfgV1))
	addTableIndicesMigrations(mg, "v1", dashboardPublicCfgV1)

	// recreate table - schema finalized for public dashboards v1
	addDropAllIndicesMigrations(mg, "v2", dashboardPublicCfgV1)
	mg.AddMigration("Drop public config table", NewDropTableMigration("dashboard_public_config"))
	mg.AddMigration("Recreate dashboard public config v2", NewAddTableMigration(dashboardPublicCfgV2))
	addTableIndicesMigrations(mg, "v2", dashboardPublicCfgV2)

	// rename table
	addTableRenameMigration(mg, "dashboard_public_config", "dashboard_public", "v2")
	// some migrations (like AddColumn) need the table object to be passed in. So we need to make sure its updated.
	dashboardPublicCfgV2.Name = "dashboard_public"

	mg.AddMigration("add annotations_enabled column", NewAddColumnMigration(dashboardPublicCfgV2, &Column{
		Name:     "annotations_enabled",
		Type:     DB_Bool,
		Nullable: false,
		Default:  "0",
	}))

	mg.AddMigration("add time_selection_enabled column", NewAddColumnMigration(dashboardPublicCfgV2, &Column{
		Name:     "time_selection_enabled",
		Type:     DB_Bool,
		Nullable: false,
		Default:  "0",
	}))

	mg.AddMigration("delete orphaned public dashboards", NewRawSQLMigration(
		"DELETE FROM dashboard_public WHERE dashboard_uid NOT IN (SELECT uid FROM dashboard)"))

	mg.AddMigration("add share column", NewAddColumnMigration(dashboardPublicCfgV2, &Column{
		Name:     "share",
		Type:     DB_NVarchar,
		Length:   64,
		Nullable: false,
		Default:  "'public'",
	}))

	mg.AddMigration("backfill empty share column fields with default of public", NewRawSQLMigration(
		"UPDATE dashboard_public SET share='public' WHERE share=''",
	))
}
