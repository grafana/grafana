package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addCacheMigration(mg *Migrator) {
	var cacheDataV1 = Table{
		Name: "cache_data",
		Columns: []*Column{
			{Name: "key", Type: DB_Char, IsPrimaryKey: true, Length: 16},
			{Name: "data", Type: DB_Blob},
			{Name: "expires", Type: DB_Integer, Length: 255, Nullable: false},
			{Name: "created_at", Type: DB_Integer, Length: 255, Nullable: false},
		},
	}

	mg.AddMigration("create cache_data table", NewAddTableMigration(cacheDataV1))
}
