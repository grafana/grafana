package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDataSourceMigration(mg *Migrator) {
	var tableV1 = Table{
		Name: "data_source",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "account_id", Type: DB_BigInt, Nullable: false},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
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
			{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
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

	mg.AddMigration("Drop old table data_source_v1 #2", NewDropTableMigration("data_source_v1"))

	// add column to activate withCredentials option
	mg.AddMigration("Add column with_credentials", NewAddColumnMigration(tableV2, &Column{
		Name: "with_credentials", Type: DB_Bool, Nullable: false, Default: "0",
	}))

	// add column that can store TLS client auth data
	mg.AddMigration("Add secure json data column", NewAddColumnMigration(tableV2, &Column{
		Name: "secure_json_data", Type: DB_Text, Nullable: true,
	}))

	mg.AddMigration("Update data_source table charset", NewTableCharsetMigration(tableV2.Name, []*Column{
		{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
		{Name: "name", Type: DB_NVarchar, Length: 190, Nullable: false},
		{Name: "access", Type: DB_NVarchar, Length: 255, Nullable: false},
		{Name: "url", Type: DB_NVarchar, Length: 255, Nullable: false},
		{Name: "password", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "user", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "database", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "basic_auth_user", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "basic_auth_password", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "json_data", Type: DB_Text, Nullable: true},
		{Name: "secure_json_data", Type: DB_Text, Nullable: true},
	}))

	const setVersionToOneWhereZero = `UPDATE data_source SET version = 1 WHERE version = 0`
	mg.AddMigration("Update initial version to 1", NewRawSQLMigration(setVersionToOneWhereZero))

	mg.AddMigration("Add read_only data column", NewAddColumnMigration(tableV2, &Column{
		Name: "read_only", Type: DB_Bool, Nullable: true,
	}))

	const migrateLoggingToLoki = `UPDATE data_source SET type = 'loki' WHERE type = 'logging'`
	mg.AddMigration("Migrate logging ds to loki ds", NewRawSQLMigration(migrateLoggingToLoki))

	const setEmptyJSONWhereNullJSON = `UPDATE data_source SET json_data = '{}' WHERE json_data is null`
	mg.AddMigration("Update json_data with nulls", NewRawSQLMigration(setEmptyJSONWhereNullJSON))

	// add column uid for linking
	mg.AddMigration("Add uid column", NewAddColumnMigration(tableV2, &Column{
		Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: false, Default: "0",
	}))

	// Initialize as id as that is unique already
	mg.AddMigration(
		"Update uid value",
		NewRawSQLMigration("").
			SQLite("UPDATE data_source SET uid=printf('%09d',id);").
			Postgres("UPDATE data_source SET uid=lpad('' || id::text,9,'0');").
			Mysql("UPDATE data_source SET uid=lpad(id,9,'0');"),
	)

	mg.AddMigration("Add unique index datasource_org_id_uid", NewAddIndexMigration(tableV2, &Index{
		Cols: []string{"org_id", "uid"}, Type: UniqueIndex,
	}))

	mg.AddMigration("add unique index datasource_org_id_is_default", NewAddIndexMigration(tableV2, &Index{
		Cols: []string{"org_id", "is_default"}}))

	mg.AddMigration("Add is_prunable column", NewAddColumnMigration(tableV2, &Column{
		Name: "is_prunable", Type: DB_Bool, Nullable: true, Default: "0",
	}))

	mg.AddMigration("Add api_version column", NewAddColumnMigration(tableV2, &Column{
		Name: "api_version", Type: DB_Varchar, Nullable: true, Length: 20,
	}))
}
