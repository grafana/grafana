package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addKVStoreMigrations(mg *Migrator) {
	kvStoreV1 := Table{
		Name: "kv_store",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "namespace", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "key", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "value", Type: DB_MediumText, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "namespace", "key"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create kv_store table v1", NewAddTableMigration(kvStoreV1))

	mg.AddMigration("add index kv_store.org_id-namespace-key", NewAddIndexMigration(kvStoreV1, kvStoreV1.Indices[0]))
}
