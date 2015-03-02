package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addLocationMigration(mg *Migrator) {
	//location
	var locationV1 = Table{
		Name: "location",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "account_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "country", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "region", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "provider", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "public", Type: DB_Bool, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"account_id", "slug"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create location table", NewAddTableMigration(locationV1))

	//-------  indexes ------------------
	mg.AddMigration("add unique index location.account_id_slug", NewAddIndexMigration(locationV1, locationV1.Indices[0]))
	
	// ---------------------
	// account -> org changes
	//-------  drop dashboard indexes ------------------
	addDropAllIndicesMigrations(mg, "v1", locationV1)
	//------- rename table ------------------
	addTableRenameMigration(mg, "location", "location_v1", "v1")

	var locationV2 = Table{
		Name: "location",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "country", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "region", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "provider", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "public", Type: DB_Bool, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"org_id", "slug"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create location table v2", NewAddTableMigration(locationV2))

	//-------  indexes ------------------
	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v2", locationV2)

	mg.AddMigration("copy location v1 to v2", NewCopyTableDataMigration("location", "location_v1", map[string]string{
		"id":       "id",
		"org_id":   "account_id",
		"slug":     "slug",
		"name":     "name",
		"country":  "country",
		"region":   "region",
		"provider": "provider",
		"public":   "public",
		"created":  "created",
		"updated":  "updated",
	}))

	mg.AddMigration("drop table location_v1", NewDropTableMigration("location_v1"))
}
