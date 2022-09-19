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
			{Name: "datasource_uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "created_by", Type: DB_Int, Nullable: false},
			{Name: "created_at", Type: DB_Int, Nullable: false},
			{Name: "comment", Type: DB_Text, Nullable: false},
			{Name: "queries", Type: DB_Text, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "created_by", "datasource_uid"}},
		},
	}

	mg.AddMigration("create query_history table v1", NewAddTableMigration(queryHistoryV1))

	mg.AddMigration("add index query_history.org_id-created_by-datasource_uid", NewAddIndexMigration(queryHistoryV1, queryHistoryV1.Indices[0]))

	mg.AddMigration("alter table query_history alter column created_by type to bigint", NewRawSQLMigration("").
		Mysql("ALTER TABLE query_history MODIFY created_by BIGINT;").
		Postgres("ALTER TABLE query_history ALTER COLUMN created_by TYPE BIGINT;"))
}
