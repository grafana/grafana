package migrations

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
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
		Indices: []*migrator.Index{
			{Cols: []string{"org_id", "uid"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create short_url table v1", NewAddTableMigration(shortURLV1))

	mg.AddMigration("add index short_url.org_id-uid", migrator.NewAddIndexMigration(shortURLV1, shortURLV1.Indices[0]))
}
