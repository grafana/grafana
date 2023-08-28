package oauthserver

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func AddMigration(mg *migrator.Migrator) {
	impersonatePermissionsTable := migrator.Table{
		Name: "oauth_impersonate_permission",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "client_id", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
			{Name: "action", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
			{Name: "scope", Type: migrator.DB_Varchar, Length: 190, Nullable: true},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"client_id", "action", "scope"}, Type: migrator.UniqueIndex},
		},
	}

	clientTable := migrator.Table{
		Name: "oauth_client",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "name", Type: migrator.DB_Varchar, Length: 190, Nullable: true},
			{Name: "client_id", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
			{Name: "secret", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
			{Name: "grant_types", Type: migrator.DB_Text, Nullable: true},
			{Name: "audiences", Type: migrator.DB_Varchar, Length: 190, Nullable: true},
			{Name: "service_account_id", Type: migrator.DB_BigInt, Nullable: true},
			{Name: "public_pem", Type: migrator.DB_Text, Nullable: true},
			{Name: "redirect_uri", Type: migrator.DB_Varchar, Length: 190, Nullable: true},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"client_id"}, Type: migrator.UniqueIndex},
			{Cols: []string{"client_id", "service_account_id"}, Type: migrator.UniqueIndex},
			{Cols: []string{"name"}, Type: migrator.UniqueIndex},
		},
	}

	// Impersonate Permission
	mg.AddMigration("create impersonate permissions table", migrator.NewAddTableMigration(impersonatePermissionsTable))

	//-------  indexes ------------------
	mg.AddMigration("add unique index client_id action scope", migrator.NewAddIndexMigration(impersonatePermissionsTable, impersonatePermissionsTable.Indices[0]))

	// Client
	mg.AddMigration("create client table", migrator.NewAddTableMigration(clientTable))

	//-------  indexes ------------------
	mg.AddMigration("add unique index client_id", migrator.NewAddIndexMigration(clientTable, clientTable.Indices[0]))
	mg.AddMigration("add unique index client_id service_account_id", migrator.NewAddIndexMigration(clientTable, clientTable.Indices[1]))
	mg.AddMigration("add unique index name", migrator.NewAddIndexMigration(clientTable, clientTable.Indices[2]))
}
