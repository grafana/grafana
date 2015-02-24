package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDataSourceMigration(mg *Migrator) {
	mg.AddMigration("create data_source table", new(AddTableMigration).
		Name("data_source").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "account_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "version", Type: DB_Int, Nullable: false},
		&Column{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "access", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "url", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "password", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "user", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "database", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "basic_auth", Type: DB_Bool, Nullable: false},
		&Column{Name: "basic_auth_user", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "basic_auth_password", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "is_default", Type: DB_Bool, Nullable: false},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	//-------  indexes ------------------
	mg.AddMigration("add index data_source.account_id", new(AddIndexMigration).
		Table("data_source").Columns("account_id"))

	mg.AddMigration("add unique index data_source.account_id_name", new(AddIndexMigration).
		Table("data_source").Columns("account_id", "name").Unique())

	// ---------------------
	// account -> org changes

	//-------  drop indexes ------------------
	mg.AddMigration("drop index data_source.account_id", new(DropIndexMigration).
		Table("data_source").Columns("account_id"))

	mg.AddMigration("drop unique index data_source.account_id_name", new(DropIndexMigration).
		Table("data_source").Columns("account_id", "name").Unique())

	//------- rename table ------------------
	mg.AddMigration("rename table data_source to data_source_old", new(RenameTableMigration).
		Rename("data_source", "data_source_old"))

	//------- recreate table with new column names ------------------
	mg.AddMigration("create data_source table v2", new(AddTableMigration).
		Name("data_source").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "version", Type: DB_Int, Nullable: false},
		&Column{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "access", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "url", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "password", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "user", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "database", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "basic_auth", Type: DB_Bool, Nullable: false},
		&Column{Name: "basic_auth_user", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "basic_auth_password", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "is_default", Type: DB_Bool, Nullable: false},
		&Column{Name: "json_data", Type: DB_Text, Nullable: true},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	//------- data_source table indexes ------------------
	mg.AddMigration("add index data_source.org_id", new(AddIndexMigration).
		Table("data_source").Columns("org_id"))

	mg.AddMigration("add unique index data_source.org_id_name", new(AddIndexMigration).
		Table("data_source").Columns("org_id", "name").Unique())

	//------- copy data from table -------------------
	mg.AddMigration("copy data from data_source_old table", new(CopyTableDataMigration).
		Source("data_source_old", "id, account_id, version, type, name, access, url, password, user, database, basic_auth, basic_auth_user, basic_auth_password, is_default, created, updated").
		Target("data_source", "id, org_id, version, type, name, access, url, password, user, database, basic_auth, basic_auth_user, basic_auth_password, is_default, created, updated"))

	mg.AddMigration("Drop old table data_source_old", new(DropTableMigration).Table("data_source_old"))
}
