package database

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func AddMigration(mg *migrator.Migrator) {
	// oauthClient := migrator.Table{
	// 	Name: "client",
	// 	Columns: []*migrator.Column{
	// 		{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
	// 		{Name: "client_id", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
	// 		{Name: "secret", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
	// 		{Name: "domain", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
	// 		{Name: "user_id", Type: migrator.DB_Varchar, Length: 190, Nullable: true}, // TODO: what is it used for?
	// 		{Name: "app_name", Type: migrator.DB_Varchar, Length: 190, Nullable: true},
	// 		{Name: "redirect_uri", Type: migrator.DB_Varchar, Length: 190, Nullable: true},
	// 		{Name: "service_account_id", Type: migrator.DB_BigInt, Nullable: true},
	// 	},
	// 	Indices: []*migrator.Index{
	// 		{Cols: []string{"client_id"}, Type: migrator.UniqueIndex},
	// 		{Cols: []string{"app_name"}, Type: migrator.UniqueIndex},
	// 	},
	// }

	// mg.AddMigration("create client table", migrator.NewAddTableMigration(oauthClient))

	// //-------  indexes ------------------
	// mg.AddMigration("add unique index client_id", migrator.NewAddIndexMigration(oauthClient, oauthClient.Indices[0]))
	// mg.AddMigration("add unique index app_name", migrator.NewAddIndexMigration(oauthClient, oauthClient.Indices[1]))
}
