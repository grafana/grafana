package signingkeys

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func AddMigration(mg *migrator.Migrator) {
	var signingKeysV1 = migrator.Table{
		Name: "signing_key",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "key_id", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "private_key", Type: migrator.DB_Text, Nullable: false},
			{Name: "added_at", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "expires_at", Type: migrator.DB_DateTime, Nullable: true},
			{Name: "alg", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"key_id"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create signing_key table", migrator.NewAddTableMigration(signingKeysV1))
	mg.AddMigration("add unique index signing_key.key_id", migrator.NewAddIndexMigration(signingKeysV1, signingKeysV1.Indices[0]))
}
