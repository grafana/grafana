package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addShortUrlMigrations(mg *Migrator) {
	shortUrlV1 := Table{
		Name: "short_url",
		Columns: []*Column{
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false, IsPrimaryKey: true},
			{Name: "path", Type: DB_Text, Nullable: false},
			{Name: "created_by", Type: DB_Int, Nullable: false},
			{Name: "created_at", Type: DB_Int, Nullable: false},
			{Name: "last_seen_at", Type: DB_Int, Nullable: true},
		},
	}

	mg.AddMigration("create short_url table v1", NewAddTableMigration(shortUrlV1))
}
