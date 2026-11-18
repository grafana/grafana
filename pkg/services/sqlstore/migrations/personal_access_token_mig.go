package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addPersonalAccessTokenMigrations(mg *Migrator) {
	table := Table{
		Name: "personal_access_token",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "token_hash", Type: DB_Varchar, Length: 64, Nullable: false},
			{Name: "prefix_hint", Type: DB_Varchar, Length: 8, Nullable: false},
			{Name: "scopes", Type: DB_Text, Nullable: true},
			{Name: "expires_at", Type: DB_DateTime, Nullable: true},
			{Name: "created_at", Type: DB_DateTime, Nullable: false},
			{Name: "created_ip", Type: DB_Varchar, Length: 64, Nullable: true},
			{Name: "last_used_at", Type: DB_DateTime, Nullable: true},
			{Name: "last_used_ip", Type: DB_Varchar, Length: 64, Nullable: true},
			{Name: "last_used_ua", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "revoked_at", Type: DB_DateTime, Nullable: true},
			{Name: "revoked_reason", Type: DB_Varchar, Length: 32, Nullable: true},
		},
		Indices: []*Index{
			{Cols: []string{"uid"}, Type: UniqueIndex},
			{Cols: []string{"token_hash"}, Type: UniqueIndex},
			{Cols: []string{"user_id", "org_id"}},
			{Cols: []string{"expires_at"}},
		},
	}

	mg.AddMigration("create personal_access_token table", NewAddTableMigration(table))
	mg.AddMigration("add unique index personal_access_token.uid", NewAddIndexMigration(table, table.Indices[0]))
	mg.AddMigration("add unique index personal_access_token.token_hash", NewAddIndexMigration(table, table.Indices[1]))
	mg.AddMigration("add index personal_access_token.user_id_org_id", NewAddIndexMigration(table, table.Indices[2]))
	mg.AddMigration("add index personal_access_token.expires_at", NewAddIndexMigration(table, table.Indices[3]))
}
