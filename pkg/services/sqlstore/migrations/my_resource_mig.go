package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addMyResourceMigrations(mg *Migrator) {
	myResourceV1 := Table{
		Name: "my_resource",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "content", Type: DB_Text, Nullable: false},
			{Name: "ready", Type: DB_Bool, Nullable: false, Default: "0"},
			{Name: "created_by", Type: DB_BigInt, Nullable: false},
			{Name: "created_at", Type: DB_BigInt, Nullable: false},
			{Name: "updated_at", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "uid"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create my_resource table v1", NewAddTableMigration(myResourceV1))

	mg.AddMigration("add index my_resource.org_id-uid", NewAddIndexMigration(myResourceV1, myResourceV1.Indices[0]))
}
