package migrations

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addSecretsMigration(mg *migrator.Migrator) {
	dataKeysV1 := migrator.Table{
		Name: "data_keys",
		Columns: []*migrator.Column{
			{Name: "name", Type: migrator.DB_NVarchar, Length: 100, IsPrimaryKey: true},
			{Name: "active", Type: migrator.DB_Bool},
			{Name: "scope", Type: migrator.DB_NVarchar, Length: 30, Nullable: false},
			{Name: "provider", Type: migrator.DB_NVarchar, Length: 50, Nullable: false},
			{Name: "encrypted_data", Type: migrator.DB_Blob, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{},
	}

	mg.AddMigration("create data_keys table", migrator.NewAddTableMigration(dataKeysV1))
}
