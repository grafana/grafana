package migrations

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

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
			{Name: "label", Type: migrator.DB_NVarchar, Length: 100, Default: "''", Nullable: false},
		},
		Indices: []*migrator.Index{},
	}

	mg.AddMigration("create data_keys table", migrator.NewAddTableMigration(dataKeysV1))

	secretsV1 := migrator.Table{
		Name: "secrets",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "type", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "value", Type: migrator.DB_Text, Nullable: true},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "namespace"}},
			{Cols: []string{"org_id", "namespace", "type"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create secrets table", migrator.NewAddTableMigration(secretsV1))
}
