package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addOrgMigrations(mg *Migrator) {
	//-------  org table -------------------
	mg.AddMigration("create org table", new(AddTableMigration).
		Name("org").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "version", Type: DB_Int, Nullable: false},
		&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "address1", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "address2", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "city", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "state", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "zip_code", Type: DB_NVarchar, Length: 50, Nullable: true},
		&Column{Name: "country", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "billing_email", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	//-------  indices -------------------
	mg.AddMigration("add unique index org.name", new(AddIndexMigration).
		Table("org").Columns("name").Unique())

	//-------  org_user table -------------------
	mg.AddMigration("create org_user table", new(AddTableMigration).
		Name("org_user").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "org_id", Type: DB_BigInt},
		&Column{Name: "user_id", Type: DB_BigInt},
		&Column{Name: "role", Type: DB_NVarchar, Length: 20},
		&Column{Name: "created", Type: DB_DateTime},
		&Column{Name: "updated", Type: DB_DateTime},
	))

	//-------  indices -------------------
	mg.AddMigration("add unique index org_user_aid_uid", new(AddIndexMigration).
		Name("org_user_aid_uid").Table("org_user").Columns("org_id", "user_id").Unique())

	//-------  TEMP table rename / copy data -------------------
	mg.AddMigration("copy data from old account table", new(CopyTableDataMigration).
		Source("account", "id, version, name, created, updated").
		Target("org", "id, version, name, created, updated").
		IfTableExists("account"))

	mg.AddMigration("copy data from old account_user table", new(CopyTableDataMigration).
		Source("account_user", "id, account_id, user_id, role, created, updated").
		Target("org_user", "id, org_id, user_id, role, created, updated").
		IfTableExists("account_user"))

	mg.AddMigration("Drop old table account", new(DropTableMigration).Table("account"))
	mg.AddMigration("Drop old table account_user", new(DropTableMigration).Table("account_user"))
}
