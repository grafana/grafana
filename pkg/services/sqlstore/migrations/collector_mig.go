package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addCollectorMigration(mg *Migrator) {
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

	// ---------------------
	// account -> org changes
	//-------  drop dashboard indexes ------------------
	addDropAllIndicesMigrations(mg, "v2", locationV2)
	//------- rename table ------------------
	addTableRenameMigration(mg, "location", "location_v2", "v2")

	var locationV3 = Table{
		Name: "location",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "latitude", Type: DB_Float, Nullable: true},
			&Column{Name: "longitude", Type: DB_Float, Nullable: true},
			&Column{Name: "public", Type: DB_Bool, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"org_id", "slug"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create location table v3", NewAddTableMigration(locationV3))

	//-------  indexes ------------------
	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v3", locationV3)

	mg.AddMigration("copy location v2 to v3", NewCopyTableDataMigration("location", "location_v2", map[string]string{
		"id":      "id",
		"org_id":  "org_id",
		"slug":    "slug",
		"name":    "name",
		"public":  "public",
		"created": "created",
		"updated": "updated",
	}))

	mg.AddMigration("drop table location_v2", NewDropTableMigration("location_v2"))

	// add location_tag
	var locationTagV1 = Table{
		Name: "location_tag",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "location_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "tag", Type: DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"org_id", "location_id"}},
			&Index{Cols: []string{"location_id", "org_id", "tag"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create location_tag table v1", NewAddTableMigration(locationTagV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", locationTagV1)

	var collectorV1 = Table{
		Name: "collector",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "latitude", Type: DB_Float, Nullable: true},
			&Column{Name: "longitude", Type: DB_Float, Nullable: true},
			&Column{Name: "public", Type: DB_Bool, Nullable: false},
			&Column{Name: "online", Type: DB_Bool, Nullable: false},
			&Column{Name: "enabled", Type: DB_Bool, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"org_id", "slug"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create collector table v1", NewAddTableMigration(collectorV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", collectorV1)

	mg.AddMigration("copy location v3 to collector v1", NewCopyTableDataMigration("collector", "location", map[string]string{
		"id":        "id",
		"org_id":    "org_id",
		"slug":      "slug",
		"name":      "name",
		"public":    "public",
		"latitude":  "latitude",
		"longitude": "longitude",
		"created":   "created",
		"updated":   "updated",
	}))

	mg.AddMigration("drop table location v3", NewDropTableMigration("location"))

	// add location_tag
	var collectorTagV1 = Table{
		Name: "collector_tag",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "collector_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "tag", Type: DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"org_id", "collector_id"}},
			&Index{Cols: []string{"collector_id", "org_id", "tag"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create collector_tag table v1", NewAddTableMigration(collectorTagV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", collectorTagV1)

	mg.AddMigration("copy location_tag v1 to collector_tag v1", NewCopyTableDataMigration("collector_tag", "location_tag", map[string]string{
		"id":           "id",
		"org_id":       "org_id",
		"collector_id": "location_id",
		"tag":          "tag",
	}))

	mg.AddMigration("drop table locationTag v1", NewDropTableMigration("location_tag"))
}
