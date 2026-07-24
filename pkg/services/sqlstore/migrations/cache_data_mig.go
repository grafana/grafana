package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addCacheMigration(mg *migrator.Migrator) {
	var cacheDataV1 = migrator.Table{
		Name: "cache_data",
		Columns: []*migrator.Column{
			{Name: "cache_key", Type: migrator.DB_NVarchar, IsPrimaryKey: true, Length: 168},
			{Name: "data", Type: migrator.DB_Blob},
			{Name: "expires", Type: migrator.DB_Integer, Length: 255, Nullable: false},
			{Name: "created_at", Type: migrator.DB_Integer, Length: 255, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"cache_key"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create cache_data table", migrator.NewAddTableMigration(cacheDataV1))

	mg.AddMigration("add unique index cache_data.cache_key", migrator.NewAddIndexMigration(cacheDataV1, cacheDataV1.Indices[0]))
}
