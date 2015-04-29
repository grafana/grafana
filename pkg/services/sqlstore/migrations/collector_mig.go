package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addCollectorMigration(mg *Migrator) {

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

	//CollectorSession
	var collectorSessionV1 = Table{
		Name: "collector_session",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "collector_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "socket_id", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"org_id"}},
			&Index{Cols: []string{"collector_id"}},
			&Index{Cols: []string{"socket_id"}},
		},
	}
	mg.AddMigration("create collector_session table", NewAddTableMigration(collectorSessionV1))
	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", collectorSessionV1)
}
