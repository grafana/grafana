package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addSiteMigration(mg *Migrator) {
	//site
	var siteV1 = Table{
		Name: "site",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "account_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"account_id", "slug"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create site table", NewAddTableMigration(siteV1))

	//-------  indexes ------------------
	mg.AddMigration("add unique index site.account_id_slug", NewAddIndexMigration(siteV1, siteV1.Indices[0]))
	
	// ---------------------
	// account -> org changes
	//-------  drop dashboard indexes ------------------
	addDropAllIndicesMigrations(mg, "v1", siteV1)
	//------- rename table ------------------
	addTableRenameMigration(mg, "site", "site_v1", "v1")

	var siteV2 = Table{
		Name: "site",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"org_id", "slug"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create site table v2", NewAddTableMigration(siteV2))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v2", siteV2)

	mg.AddMigration("copy site v1 to v2", NewCopyTableDataMigration("site", "site_v1", map[string]string{
		"id":              "id",
		"org_id":          "account_id",
		"slug":            "slug",
		"name":            "name",
		"created":         "created",
		"updated":         "updated",
	}))

	mg.AddMigration("drop table site_v1", NewDropTableMigration("site_v1"))

}