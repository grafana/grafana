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

	mg.AddMigration("add column org_id in query_history_star", NewAddColumnMigration(queryHistoryStarV1, &Column{
		Name: "org_id", Type: DB_BigInt, Nullable: false, Default: "1",
	}))

	mg.AddMigration("alter table query_history_star_mig column user_id type to bigint", NewRawSQLMigration("").
		Mysql("ALTER TABLE query_history_star MODIFY user_id BIGINT;").
		Postgres("ALTER TABLE query_history_star ALTER COLUMN user_id TYPE BIGINT;"))
}
