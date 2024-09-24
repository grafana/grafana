package externalsession

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func AddMigration(mg *migrator.Migrator) {
	var externalSessionV1 = migrator.Table{
		Name: "external_session",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_auth_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "user_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "access_token", Type: migrator.DB_Text, Nullable: true},
			{Name: "id_token", Type: migrator.DB_Text, Nullable: true},
			{Name: "refresh_token", Type: migrator.DB_Text, Nullable: true},
			{Name: "session_id", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "name_id", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "expires_at", Type: migrator.DB_DateTime, Nullable: true},
			{Name: "created_at", Type: migrator.DB_DateTime, Nullable: false},
		},
	}

	mg.AddMigration("create external_session table", migrator.NewAddTableMigration(externalSessionV1))
}
