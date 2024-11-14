package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addUserAuthMigrations(mg *Migrator) {
	userAuthV1 := Table{
		Name: "user_auth",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "auth_module", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "auth_id", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"auth_module", "auth_id"}},
		},
	}

	// create table
	mg.AddMigration("create user auth table", NewAddTableMigration(userAuthV1))
	// add indices
	addTableIndicesMigrations(mg, "v1", userAuthV1)

	mg.AddMigration("alter user_auth.auth_id to length 190", NewRawSQLMigration("").
		Postgres("ALTER TABLE user_auth ALTER COLUMN auth_id TYPE VARCHAR(190);").
		Mysql("ALTER TABLE user_auth MODIFY auth_id VARCHAR(190);"))

	mg.AddMigration("Add OAuth access token to user_auth", NewAddColumnMigration(userAuthV1, &Column{
		Name: "o_auth_access_token", Type: DB_Text, Nullable: true,
	}))
	mg.AddMigration("Add OAuth refresh token to user_auth", NewAddColumnMigration(userAuthV1, &Column{
		Name: "o_auth_refresh_token", Type: DB_Text, Nullable: true,
	}))
	mg.AddMigration("Add OAuth token type to user_auth", NewAddColumnMigration(userAuthV1, &Column{
		Name: "o_auth_token_type", Type: DB_Text, Nullable: true,
	}))
	mg.AddMigration("Add OAuth expiry to user_auth", NewAddColumnMigration(userAuthV1, &Column{
		Name: "o_auth_expiry", Type: DB_DateTime, Nullable: true,
	}))

	mg.AddMigration("Add index to user_id column in user_auth", NewAddIndexMigration(userAuthV1, &Index{
		Cols: []string{"user_id"},
	}))

	mg.AddMigration("Add OAuth ID token to user_auth", NewAddColumnMigration(userAuthV1, &Column{
		Name: "o_auth_id_token", Type: DB_Text, Nullable: true,
	}))
}
