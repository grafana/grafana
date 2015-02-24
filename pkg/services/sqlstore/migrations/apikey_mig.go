package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addApiKeyMigrations(mg *Migrator) {
	mg.AddMigration("create api_key table", new(AddTableMigration).
		Name("api_key").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "account_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "key", Type: DB_Varchar, Length: 64, Nullable: false},
		&Column{Name: "role", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	//-------  indexes ------------------
	mg.AddMigration("add index api_key.account_id", new(AddIndexMigration).
		Table("api_key").Columns("account_id"))

	mg.AddMigration("add index api_key.key", new(AddIndexMigration).
		Table("api_key").Columns("key").Unique())

	mg.AddMigration("add index api_key.account_id_name", new(AddIndexMigration).
		Table("api_key").Columns("account_id", "name").Unique())

	// ---------------------
	// account -> org changes

	//-------  drop indexes ------------------
	mg.AddMigration("drop index api_key.account_id", new(DropIndexMigration).
		Table("api_key").Columns("account_id"))

	mg.AddMigration("drop index api_key.key", new(DropIndexMigration).
		Table("api_key").Columns("key").Unique())

	mg.AddMigration("drop index api_key.account_id_name", new(DropIndexMigration).
		Table("api_key").Columns("account_id", "name").Unique())

	//------- rename table ------------------
	mg.AddMigration("rename table api_key to api_key_old", new(RenameTableMigration).
		Rename("api_key", "api_key_old"))

	//------- recreate table with new column names ------------------
	mg.AddMigration("create api_key table v2", new(AddTableMigration).
		Name("api_key").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "key", Type: DB_Varchar, Length: 64, Nullable: false},
		&Column{Name: "role", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	//------- recreate indexes ------------------
	mg.AddMigration("add index api_key.org_id", new(AddIndexMigration).
		Table("api_key").Columns("org_id"))

	mg.AddMigration("add index api_key.key v2", new(AddIndexMigration).
		Table("api_key").Columns("key").Unique())

	mg.AddMigration("add index api_key.org_id_name", new(AddIndexMigration).
		Table("api_key").Columns("org_id", "name").Unique())

	//------- copy data from old api_key_old -------------------
	mg.AddMigration("copy data from old api_key table", new(CopyTableDataMigration).
		Source("api_key_old", "id, account_id, name, key, role, created, updated").
		Target("api_key", "id, org_id, name, key, role, created, updated"))

	mg.AddMigration("Drop old table api_key_old", new(DropTableMigration).Table("api_key_old"))
}
