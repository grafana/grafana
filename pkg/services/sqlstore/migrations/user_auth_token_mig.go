package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addUserAuthTokenMigrations(mg *Migrator) {
	addStableSessionMigrations(mg, addUserAuthTokenV1Migrations(mg))
}

func addUserAuthTokenV1Migrations(mg *Migrator) Table {
	userAuthTokenV1 := Table{
		Name: "user_auth_token",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "auth_token", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "prev_auth_token", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "user_agent", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "client_ip", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "auth_token_seen", Type: DB_Bool, Nullable: false},
			{Name: "seen_at", Type: DB_Int, Nullable: true},
			{Name: "rotated_at", Type: DB_Int, Nullable: false},
			{Name: "created_at", Type: DB_Int, Nullable: false},
			{Name: "updated_at", Type: DB_Int, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"auth_token"}, Type: UniqueIndex},
			{Cols: []string{"prev_auth_token"}, Type: UniqueIndex},
			{Cols: []string{"user_id"}, Type: IndexType},
		},
	}

	mg.AddMigration("create user auth token table", NewAddTableMigration(userAuthTokenV1))
	mg.AddMigration("add unique index user_auth_token.auth_token", NewAddIndexMigration(userAuthTokenV1, userAuthTokenV1.Indices[0]))
	mg.AddMigration("add unique index user_auth_token.prev_auth_token", NewAddIndexMigration(userAuthTokenV1, userAuthTokenV1.Indices[1]))

	mg.AddMigration("add index user_auth_token.user_id", NewAddIndexMigration(userAuthTokenV1, userAuthTokenV1.Indices[2]))

	mg.AddMigration(
		"Add revoked_at to the user auth token",
		NewAddColumnMigration(
			userAuthTokenV1,
			&Column{
				Name:     "revoked_at",
				Type:     DB_Int,
				Nullable: true,
			},
		),
	)

	mg.AddMigration("add index user_auth_token.revoked_at", NewAddIndexMigration(userAuthTokenV1, &Index{
		Cols: []string{"revoked_at"},
	}))

	mg.AddMigration("add external_session_id to user_auth_token", NewAddColumnMigration(userAuthTokenV1, &Column{
		Name: "external_session_id", Type: DB_BigInt, Nullable: true,
	}))
	return userAuthTokenV1
}

func addStableSessionMigrations(mg *Migrator, userAuthTokenV1 Table) {
	mg.AddMigration("backfill session activity from rotation", NewRawSQLMigration(
		"UPDATE user_auth_token SET seen_at = CASE WHEN COALESCE(seen_at, 0) > rotated_at THEN seen_at ELSE rotated_at END"))
	addDropAllIndicesMigrations(mg, "stable sessions", userAuthTokenV1)
	mg.AddMigration("drop user auth token revoked index for stable sessions", NewDropIndexMigration(userAuthTokenV1, &Index{Cols: []string{"revoked_at"}}))
	addTableRenameMigration(mg, "user_auth_token", "user_auth_token_v1", "stable sessions")

	stableSessions := Table{
		Name: "user_auth_token",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "auth_token", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "user_agent", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "client_ip", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "seen_at", Type: DB_Int, Nullable: false},
			{Name: "created_at", Type: DB_Int, Nullable: false},
			{Name: "updated_at", Type: DB_Int, Nullable: false},
			{Name: "revoked_at", Type: DB_Int, Nullable: true},
			{Name: "external_session_id", Type: DB_BigInt, Nullable: true},
		},
		Indices: []*Index{
			{Cols: []string{"auth_token"}, Type: UniqueIndex},
			{Cols: []string{"user_id"}, Type: IndexType},
			{Cols: []string{"revoked_at"}, Type: IndexType},
		},
	}
	mg.AddMigration("create stable session table", NewAddTableMigration(stableSessions))
	addTableIndicesMigrations(mg, "stable sessions", stableSessions)
	mg.AddMigration("copy stable sessions", NewCopyTableDataMigration("user_auth_token", "user_auth_token_v1", map[string]string{
		"id": "id", "user_id": "user_id", "auth_token": "auth_token",
		"user_agent": "user_agent", "client_ip": "client_ip", "seen_at": "seen_at",
		"created_at": "created_at", "updated_at": "updated_at", "revoked_at": "revoked_at",
		"external_session_id": "external_session_id",
	}))
	mg.AddMigration("reset stable session sequence", NewRawSQLMigration("").Postgres(
		"SELECT setval(pg_get_serial_sequence('user_auth_token', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM user_auth_token"))
	mg.AddMigration("drop rotating session table", NewDropTableMigration("user_auth_token_v1"))
}
