package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardMigration(mg *Migrator) {
	var dashboardV1 = Table{
		Name: "dashboard",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "slug", Type: DB_NVarchar, Length: 189, Nullable: false},
			{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: false},
			{Name: "account_id", Type: DB_BigInt, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"account_id"}},
			{Cols: []string{"account_id", "slug"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create dashboard table", NewAddTableMigration(dashboardV1))

	//-------  indexes ------------------
	mg.AddMigration("add index dashboard.account_id", NewAddIndexMigration(dashboardV1, dashboardV1.Indices[0]))
	mg.AddMigration("add unique index dashboard_account_id_slug", NewAddIndexMigration(dashboardV1, dashboardV1.Indices[1]))

	dashboardTagV1 := Table{
		Name: "dashboard_tag",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
			{Name: "term", Type: DB_NVarchar, Length: 50, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"dashboard_id", "term"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create dashboard_tag table", NewAddTableMigration(dashboardTagV1))
	mg.AddMigration("add unique index dashboard_tag.dasboard_id_term", NewAddIndexMigration(dashboardTagV1, dashboardTagV1.Indices[0]))

	// ---------------------
	// account -> org changes

	//-------  drop dashboard indexes ------------------
	addDropAllIndicesMigrations(mg, "v1", dashboardTagV1)
	//------- rename table ------------------
	addTableRenameMigration(mg, "dashboard", "dashboard_v1", "v1")

	// dashboard v2
	var dashboardV2 = Table{
		Name: "dashboard",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "slug", Type: DB_NVarchar, Length: 189, Nullable: false},
			{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "slug"}, Type: UniqueIndex},
		},
	}

	// recreate table
	mg.AddMigration("create dashboard v2", NewAddTableMigration(dashboardV2))
	// recreate indices
	addTableIndicesMigrations(mg, "v2", dashboardV2)
	// copy data
	mg.AddMigration("copy dashboard v1 to v2", NewCopyTableDataMigration("dashboard", "dashboard_v1", map[string]string{
		"id":      "id",
		"version": "version",
		"slug":    "slug",
		"title":   "title",
		"data":    "data",
		"org_id":  "account_id",
		"created": "created",
		"updated": "updated",
	}))

	mg.AddMigration("drop table dashboard_v1", NewDropTableMigration("dashboard_v1"))

	// change column type of dashboard.data
	mg.AddMigration("alter dashboard.data to mediumtext v1", new(RawSqlMigration).
		Sqlite("SELECT 0 WHERE 0;").
		Postgres("SELECT 0;").
		Mysql("ALTER TABLE dashboard MODIFY data MEDIUMTEXT;"))

	// add column to store updater of a dashboard
	mg.AddMigration("Add column updated_by in dashboard - v2", NewAddColumnMigration(dashboardV2, &Column{
		Name: "updated_by", Type: DB_Int, Nullable: true,
	}))

	// add column to store creator of a dashboard
	mg.AddMigration("Add column created_by in dashboard - v2", NewAddColumnMigration(dashboardV2, &Column{
		Name: "created_by", Type: DB_Int, Nullable: true,
	}))

	// add column to store gnetId
	mg.AddMigration("Add column gnetId in dashboard", NewAddColumnMigration(dashboardV2, &Column{
		Name: "gnet_id", Type: DB_BigInt, Nullable: true,
	}))

	mg.AddMigration("Add index for gnetId in dashboard", NewAddIndexMigration(dashboardV2, &Index{
		Cols: []string{"gnet_id"}, Type: IndexType,
	}))

	// add column to store plugin_id
	mg.AddMigration("Add column plugin_id in dashboard", NewAddColumnMigration(dashboardV2, &Column{
		Name: "plugin_id", Type: DB_NVarchar, Nullable: true, Length: 189,
	}))

	mg.AddMigration("Add index for plugin_id in dashboard", NewAddIndexMigration(dashboardV2, &Index{
		Cols: []string{"org_id", "plugin_id"}, Type: IndexType,
	}))

	// dashboard_id index for dashboard_tag table
	mg.AddMigration("Add index for dashboard_id in dashboard_tag", NewAddIndexMigration(dashboardTagV1, &Index{
		Cols: []string{"dashboard_id"}, Type: IndexType,
	}))

	mg.AddMigration("Update dashboard table charset", NewTableCharsetMigration("dashboard", []*Column{
		{Name: "slug", Type: DB_NVarchar, Length: 189, Nullable: false},
		{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
		{Name: "plugin_id", Type: DB_NVarchar, Nullable: true, Length: 189},
		{Name: "data", Type: DB_MediumText, Nullable: false},
	}))

	mg.AddMigration("Update dashboard_tag table charset", NewTableCharsetMigration("dashboard_tag", []*Column{
		{Name: "term", Type: DB_NVarchar, Length: 50, Nullable: false},
	}))
}
