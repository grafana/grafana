package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addQueryHistoryStarMigrations(mg *Migrator) {
	queryHistoryStarV1 := Table{
		Name: "query_history_star",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "query_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "user_id", Type: DB_Int, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"user_id", "query_uid"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create query_history_star table v1", NewAddTableMigration(queryHistoryStarV1))

	mg.AddMigration("add index query_history.user_id-query_uid", NewAddIndexMigration(queryHistoryStarV1, queryHistoryStarV1.Indices[0]))
}
