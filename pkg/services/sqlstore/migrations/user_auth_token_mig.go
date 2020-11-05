package migrations

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addUserAuthTokenMigrations(mg *migrator.Migrator) {
	userAuthTokenV1 := migrator.Table{
		Name: "user_auth_token",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "auth_token", Type: migrator.DB_NVarchar, Length: 100, Nullable: false},
			{Name: "prev_auth_token", Type: migrator.DB_NVarchar, Length: 100, Nullable: false},
			{Name: "user_agent", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "client_ip", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "auth_token_seen", Type: migrator.DB_Bool, Nullable: false},
			{Name: "seen_at", Type: migrator.DB_Int, Nullable: true},
			{Name: "rotated_at", Type: migrator.DB_Int, Nullable: false},
			{Name: "created_at", Type: migrator.DB_Int, Nullable: false},
			{Name: "updated_at", Type: migrator.DB_Int, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"auth_token"}, Type: migrator.UniqueIndex},
			{Cols: []string{"prev_auth_token"}, Type: migrator.UniqueIndex},
			{Cols: []string{"user_id"}, Type: migrator.IndexType},
		},
	}

	mg.AddMigration("create user auth token table", migrator.NewAddTableMigration(userAuthTokenV1))
	mg.AddMigration("add unique index user_auth_token.auth_token", migrator.NewAddIndexMigration(userAuthTokenV1, userAuthTokenV1.Indices[0]))
	mg.AddMigration("add unique index user_auth_token.prev_auth_token", migrator.NewAddIndexMigration(userAuthTokenV1, userAuthTokenV1.Indices[1]))

	mg.AddMigration("add index user_auth_token.user_id", migrator.NewAddIndexMigration(userAuthTokenV1, userAuthTokenV1.Indices[2]))
}
