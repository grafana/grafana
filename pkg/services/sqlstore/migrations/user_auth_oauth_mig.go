package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addUserAuthOAuthMigrations(mg *Migrator) {
	userAuthV2 := Table{Name: "user_auth"}

	mg.AddMigration("Add OAuth access token to user_auth", NewAddColumnMigration(userAuthV2, &Column{
		Name: "o_auth_access_token", Type: DB_Text, Nullable: true,
	}))
	mg.AddMigration("Add OAuth refresh token to user_auth", NewAddColumnMigration(userAuthV2, &Column{
		Name: "o_auth_refresh_token", Type: DB_Text, Nullable: true,
	}))
	mg.AddMigration("Add OAuth token type to user_auth", NewAddColumnMigration(userAuthV2, &Column{
		Name: "o_auth_token_type", Type: DB_Text, Nullable: true,
	}))
	mg.AddMigration("Add OAuth expiry to user_auth", NewAddColumnMigration(userAuthV2, &Column{
		Name: "o_auth_expiry", Type: DB_DateTime, Nullable: true,
	}))

	mg.AddMigration("Add index to user_id column in user_auth", NewAddIndexMigration(userAuthV2, &Index{
		Cols: []string{"user_id"},
	}))

}
