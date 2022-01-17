package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addQueryHistoryMigrations(mg *Migrator) {
	queryHistoryV1 := Table{
		Name: "query_history",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "datasource_uid", Type: DB_Text, Nullable: false},
			{Name: "created_by", Type: DB_Int, Nullable: false},
			{Name: "created_at", Type: DB_Int, Nullable: false},
			{Name: "comment", Type: DB_Text, Nullable: false},
			{Name: "queries", Type: DB_Text, Nullable: false},
		},
	}

	mg.AddMigration("create query_history table v1", NewAddTableMigration(queryHistoryV1))
}
