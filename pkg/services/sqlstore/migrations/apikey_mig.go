package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addApiKeyMigrations(mg *Migrator) {
	apiKeyV1 := Table{
		Name: "api_key",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "account_id", Type: DB_BigInt, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "key", Type: DB_Varchar, Length: 64, Nullable: false},
			{Name: "role", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"account_id"}},
			{Cols: []string{"key"}, Type: UniqueIndex},
			{Cols: []string{"account_id", "name"}, Type: UniqueIndex},
		},
	}

	// create table
	mg.AddMigration("create api_key table", NewAddTableMigration(apiKeyV1))
	// create indices
	mg.AddMigration("add index api_key.account_id", NewAddIndexMigration(apiKeyV1, apiKeyV1.Indices[0]))
	mg.AddMigration("add index api_key.key", NewAddIndexMigration(apiKeyV1, apiKeyV1.Indices[1]))
	mg.AddMigration("add index api_key.account_id_name", NewAddIndexMigration(apiKeyV1, apiKeyV1.Indices[2]))

	// ---------------------
	// account -> org changes

	// drop indexes
	addDropAllIndicesMigrations(mg, "v1", apiKeyV1)
	// rename table
	addTableRenameMigration(mg, "api_key", "api_key_v1", "v1")

	apiKeyV2 := Table{
		Name: "api_key",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "key", Type: DB_Varchar, Length: 190, Nullable: false},
			{Name: "role", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"key"}, Type: UniqueIndex},
			{Cols: []string{"org_id", "name"}, Type: UniqueIndex},
		},
	}

	// create v2 table
	mg.AddMigration("create api_key table v2", NewAddTableMigration(apiKeyV2))

	// add v2 indíces
	addTableIndicesMigrations(mg, "v2", apiKeyV2)

	//------- copy data from v1 to v2 -------------------
	mg.AddMigration("copy api_key v1 to v2", NewCopyTableDataMigration("api_key", "api_key_v1", map[string]string{
		"id":      "id",
		"org_id":  "account_id",
		"name":    "name",
		"key":     "key",
		"role":    "role",
		"created": "created",
		"updated": "updated",
	}))

	mg.AddMigration("Drop old table api_key_v1", NewDropTableMigration("api_key_v1"))

	mg.AddMigration("Update api_key table charset", NewTableCharsetMigration("api_key", []*Column{
		{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
		{Name: "key", Type: DB_Varchar, Length: 190, Nullable: false},
		{Name: "role", Type: DB_NVarchar, Length: 255, Nullable: false},
	}))

	mg.AddMigration("Add expires to api_key table", NewAddColumnMigration(apiKeyV2, &Column{
		Name: "expires", Type: DB_BigInt, Nullable: true,
	}))

	mg.AddMigration("Add service account foreign key", NewAddColumnMigration(apiKeyV2, &Column{
		Name: "service_account_id", Type: DB_BigInt, Nullable: true,
	}))

	mg.AddMigration("set service account foreign key to nil if 0", NewRawSQLMigration(
		"UPDATE api_key SET service_account_id = NULL WHERE service_account_id = 0;"))

	mg.AddMigration("Add last_used_at to api_key table", NewAddColumnMigration(apiKeyV2, &Column{
		Name: "last_used_at", Type: DB_DateTime, Nullable: true,
	}))

	// is_revoked indicates whether key is revoked or not. Revoked keys should be kept in the table, but invalid.
	mg.AddMigration("Add is_revoked column to api_key table", NewAddColumnMigration(apiKeyV2, &Column{
		Name: "is_revoked", Type: DB_Bool, Nullable: true, Default: "0",
	}))
}
