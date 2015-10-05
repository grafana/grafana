package migrations

import . "github.com/Cepave/grafana/pkg/services/sqlstore/migrator"

func addDashboardMigration(mg *Migrator) {
	var dashboardV1 = Table{
		Name: "dashboard",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
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
			{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
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
}
