package externalsession

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func AddMigration(mg *migrator.Migrator) {
	externalSessionV1 := migrator.Table{
		Name: "user_external_session",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_auth_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "user_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "auth_module", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "access_token", Type: migrator.DB_Text, Nullable: true},
			{Name: "id_token", Type: migrator.DB_Text, Nullable: true},
			{Name: "refresh_token", Type: migrator.DB_Text, Nullable: true},
			{Name: "session_id", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "session_id_hash", Type: migrator.DB_Char, Length: 44, Nullable: true},
			{Name: "name_id", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "name_id_hash", Type: migrator.DB_Char, Length: 44, Nullable: true},
			{Name: "expires_at", Type: migrator.DB_DateTime, Nullable: true},
			{Name: "created_at", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"user_id"}},
			{Cols: []string{"session_id_hash"}},
			{Cols: []string{"name_id_hash"}},
		},
	}

	mg.AddMigration("create user_external_session table", migrator.NewAddTableMigration(externalSessionV1))

	mg.AddMigration("increase name_id column length to 1024", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE user_external_session MODIFY name_id NVARCHAR(1024);").
		Postgres("ALTER TABLE user_external_session ALTER COLUMN name_id TYPE VARCHAR(1024);"))

	mg.AddMigration("increase session_id column length to 1024", migrator.NewRawSQLMigration("").
		Mysql("ALTER TABLE user_external_session MODIFY session_id NVARCHAR(1024);").
		Postgres("ALTER TABLE user_external_session ALTER COLUMN session_id TYPE VARCHAR(1024);"))
}
