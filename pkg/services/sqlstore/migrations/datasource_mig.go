package migrations

import . "github.com/Cepave/grafana/pkg/services/sqlstore/migrator"

func addDataSourceMigration(mg *Migrator) {
	var tableV1 = Table{
		Name: "data_source",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "account_id", Type: DB_BigInt, Nullable: false},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "access", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "url", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "password", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "user", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "database", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "basic_auth", Type: DB_Bool, Nullable: false},
			{Name: "basic_auth_user", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "basic_auth_password", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "is_default", Type: DB_Bool, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"account_id"}},
			{Cols: []string{"account_id", "name"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create data_source table", NewAddTableMigration(tableV1))
	mg.AddMigration("add index data_source.account_id", NewAddIndexMigration(tableV1, tableV1.Indices[0]))
	mg.AddMigration("add unique index data_source.account_id_name", NewAddIndexMigration(tableV1, tableV1.Indices[1]))

	// ---------------------
	// account -> org changes

	// drop v1 indices
	addDropAllIndicesMigrations(mg, "v1", tableV1)
	// rename table
	addTableRenameMigration(mg, "data_source", "data_source_v1", "v1")

	// new table
	var tableV2 = Table{
		Name: "data_source",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "access", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "url", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "password", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "user", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "database", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "basic_auth", Type: DB_Bool, Nullable: false},
			{Name: "basic_auth_user", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "basic_auth_password", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "is_default", Type: DB_Bool, Nullable: false},
			{Name: "json_data", Type: DB_Text, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "name"}, Type: UniqueIndex},
		},
	}

	// create v2 table
	mg.AddMigration("create data_source table v2", NewAddTableMigration(tableV2))

	// add v2 indíces
	addTableIndicesMigrations(mg, "v2", tableV2)

	//------- copy data from v1 to v2 -------------------
	mg.AddMigration("copy data_source v1 to v2", NewCopyTableDataMigration("data_source", "data_source_v1", map[string]string{
		"id":                  "id",
		"org_id":              "account_id",
		"version":             "version",
		"type":                "type",
		"name":                "name",
		"access":              "access",
		"url":                 "url",
		"user":                "user",
		"password":            "password",
		"database":            "database",
		"basic_auth":          "basic_auth",
		"basic_auth_user":     "basic_auth_user",
		"basic_auth_password": "basic_auth_password",
		"is_default":          "is_default",
		"created":             "created",
		"updated":             "updated",
	}))

	mg.AddMigration("Drop old table data_source_v1 #2", NewDropTableMigration("data_source_v1"))
}
