package migrations

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addShortURLMigrations(mg *migrator.Migrator) {
	shortURLV1 := migrator.Table{
		Name: "short_url",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "path", Type: migrator.DB_Text, Nullable: false},
			{Name: "created_by", Type: migrator.DB_Int, Nullable: false},
			{Name: "created_at", Type: migrator.DB_Int, Nullable: false},
			{Name: "last_seen_at", Type: migrator.DB_Int, Nullable: true},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id", "uid"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create short_url table v1", migrator.NewAddTableMigration(shortURLV1))

	mg.AddMigration("add index short_url.org_id-uid", migrator.NewAddIndexMigration(shortURLV1, shortURLV1.Indices[0]))
}
