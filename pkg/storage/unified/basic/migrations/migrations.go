package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func AddBasicResourceMigrations(mg *migrator.Migrator) {
	mg.AddMigration("create unified storage basic resource table", migrator.NewAddTableMigration(migrator.Table{
		Name: "basic_resource",
		Columns: []*migrator.Column{
			// Sequential resource version
			{Name: "rv", Type: migrator.DB_BigInt, Nullable: false, IsPrimaryKey: true, IsAutoIncrement: true},

			// Properties that exist in path/key (and duplicated in the json value)
			{Name: "api_group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},  // avoid "group" so escaping is easier :)
			{Name: "api_version", Type: migrator.DB_NVarchar, Length: 32, Nullable: false}, // informational
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: true},    // namespace is not required (cluster scope)
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},

			// The k8s resource JSON text (without the resourceVersion populated)
			{Name: "value", Type: migrator.DB_MediumText, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"api_group", "resource", "namespace", "name"}, Type: migrator.UniqueIndex},
		},
	}))
}
