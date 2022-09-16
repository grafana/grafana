package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addShortURLMigrations(mg *Migrator) {
	shortURLV1 := Table{
		Name: "short_url",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "path", Type: DB_Text, Nullable: false},
			{Name: "created_by", Type: DB_Int, Nullable: false},
			{Name: "created_at", Type: DB_Int, Nullable: false},
			{Name: "last_seen_at", Type: DB_Int, Nullable: true},
		},
		Indices: []*Index{
			{Cols: []string{"org_id", "uid"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create short_url table v1", NewAddTableMigration(shortURLV1))

	mg.AddMigration("add index short_url.org_id-uid", NewAddIndexMigration(shortURLV1, shortURLV1.Indices[0]))

	mg.AddMigration("alter table short_url alter column created_by type to bigint", NewRawSQLMigration("").
		Mysql("ALTER TABLE short_url MODIFY created_by BIGINT;").
		Postgres("ALTER TABLE short_url ALTER COLUMN created_by TYPE BIGINT;"))
}
