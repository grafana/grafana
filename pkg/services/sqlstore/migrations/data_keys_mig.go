package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDataKeysMigrations(mg *migrator.Migrator) {
	dataKeysV1 := migrator.Table{
		Name: "data_keys",
		Columns: []*migrator.Column{
			{Name: "name", Type: migrator.DB_NVarchar, Length: 50, IsPrimaryKey: true},
			{Name: "active", Type: migrator.DB_Bool},
			{Name: "provider", Type: migrator.DB_NVarchar, Length: 50, Nullable: true},
			{Name: "encrypted_data", Type: migrator.DB_Blob, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{},
	}

	mg.AddMigration("create data keys table", migrator.NewAddTableMigration(dataKeysV1))
}
