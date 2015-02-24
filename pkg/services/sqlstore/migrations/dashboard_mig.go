package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardMigration(mg *Migrator) {
	mg.AddMigration("create dashboard table", new(AddTableMigration).
		Name("dashboard").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "version", Type: DB_Int, Nullable: false},
		&Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "data", Type: DB_Text, Nullable: false},
		&Column{Name: "account_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	mg.AddMigration("create dashboard_tag table", new(AddTableMigration).
		Name("dashboard_tag").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "term", Type: DB_NVarchar, Length: 50, Nullable: false},
	))

	//-------  indexes ------------------
	mg.AddMigration("add index dashboard.account_id", new(AddIndexMigration).
		Table("dashboard").Columns("account_id"))

	mg.AddMigration("add unique index dashboard_account_id_slug", new(AddIndexMigration).
		Table("dashboard").Columns("account_id", "slug").Unique())

	mg.AddMigration("add unique index dashboard_tag.dasboard_id_term", new(AddIndexMigration).
		Table("dashboard_tag").Columns("dashboard_id", "term").Unique())

	// ---------------------
	// account -> org changes

	//-------  drop indexes ------------------
	mg.AddMigration("drop index dashboard.account_id", new(DropIndexMigration).
		Table("dashboard").Columns("account_id"))

	mg.AddMigration("drop unique index dashboard_account_id_slug", new(DropIndexMigration).
		Table("dashboard").Columns("account_id", "slug").Unique())

	mg.AddMigration("drop unique index dashboard_tag.dasboard_id_term", new(DropIndexMigration).
		Table("dashboard_tag").Columns("dashboard_id", "term").Unique())

	//------- rename table ------------------
	mg.AddMigration("rename table dashboard to dashboard_old", new(RenameTableMigration).
		Rename("dashboard", "dashboard_old"))

	//------- recreate table with new column names ------------------
	mg.AddMigration("create dashboard table v2", new(AddTableMigration).
		Name("dashboard").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "version", Type: DB_Int, Nullable: false},
		&Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "data", Type: DB_Text, Nullable: false},
		&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	//-------  dashboard table indexes ------------------
	mg.AddMigration("add index dashboard.org_id", new(AddIndexMigration).
		Table("dashboard").Columns("org_id"))

	mg.AddMigration("add unique index dashboard_org_id_slug", new(AddIndexMigration).
		Table("dashboard").Columns("org_id", "slug").Unique())

	mg.AddMigration("add unique index dashboard_tag.dasboard_id_term v2", new(AddIndexMigration).
		Table("dashboard_tag").Columns("dashboard_id", "term").Unique())

	//------- copy data from table -------------------
	mg.AddMigration("copy data from dashboard_old table", new(CopyTableDataMigration).
		Source("dashboard_old", "id, version, slug, title, data, account_id, created, updated").
		Target("dashboard", "id, version, slug, title, data, org_id, created, updated"))

	mg.AddMigration("Drop old table dashboard_old", new(DropTableMigration).Table("dashboard_old"))
}
