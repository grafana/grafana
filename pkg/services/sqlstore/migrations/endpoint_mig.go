package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addEndpointMigration(mg *Migrator) {

	var endpointV1 = Table{
		Name: "endpoint",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"org_id", "name"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create endpoint table v1", NewAddTableMigration(endpointV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", endpointV1)

	slugCol := &Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false}
	mg.AddMigration("add slug column to endpoint v1", NewAddColumnMigration(endpointV1, slugCol))

	// add endpoint_tags
	var endpointTagV1 = Table{
		Name: "endpoint_tag",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "endpoint_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "tag", Type: DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"org_id", "endpoint_id"}},
			&Index{Cols: []string{"endpoint_id", "tag"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create endpoint_tag table v1", NewAddTableMigration(endpointTagV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", endpointTagV1)

}
