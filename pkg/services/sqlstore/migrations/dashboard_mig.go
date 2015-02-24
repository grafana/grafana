package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardMigration(mg *Migrator) {
	var dashboardV1 = Table{
		Name: "dashboard",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "version", Type: DB_Int, Nullable: false},
			&Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "data", Type: DB_Text, Nullable: false},
			&Column{Name: "account_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"account_id"}},
			&Index{Cols: []string{"account_id", "slug"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create dashboard table", NewAddTableMigration(dashboardV1))

	//-------  indexes ------------------
	mg.AddMigration("add index dashboard.account_id", NewAddIndexMigration(dashboardV1, dashboardV1.Indices[0]))
	mg.AddMigration("add unique index dashboard_account_id_slug", NewAddIndexMigration(dashboardV1, dashboardV1.Indices[1]))

	dashboardTagV1 := Table{
		Name: "dashboard_tag",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "term", Type: DB_NVarchar, Length: 50, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"dashboard_id", "term"}, Type: UniqueIndex},
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
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "version", Type: DB_Int, Nullable: false},
			&Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "data", Type: DB_Text, Nullable: false},
			&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"org_id"}},
			&Index{Cols: []string{"org_id", "slug"}, Type: UniqueIndex},
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
}
