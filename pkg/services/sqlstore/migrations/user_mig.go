package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addUserMigrations(mg *Migrator) {
	mg.AddMigration("create user table", new(AddTableMigration).
		Name("user").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "version", Type: DB_Int, Nullable: false},
		&Column{Name: "login", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "email", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "password", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "salt", Type: DB_NVarchar, Length: 50, Nullable: true},
		&Column{Name: "rands", Type: DB_NVarchar, Length: 50, Nullable: true},
		&Column{Name: "company", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "account_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "is_admin", Type: DB_Bool, Nullable: false},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	mg.AddMigration("Add email_verified flag", new(AddColumnMigration).
		Table("user").Column(&Column{Name: "email_verified", Type: DB_Bool, Nullable: true}))

	mg.AddMigration("Add user.theme column", new(AddColumnMigration).
		Table("user").Column(&Column{Name: "theme", Type: DB_Varchar, Nullable: true, Length: 20}))

	//-------  user table indexes ------------------
	mg.AddMigration("add unique index user.login", new(AddIndexMigration).
		Table("user").Columns("login").Unique())

	mg.AddMigration("add unique index user.email", new(AddIndexMigration).
		Table("user").Columns("email").Unique())

	// ---------------------
	// account -> org changes

	//-------  drop indexes ------------------
	mg.AddMigration("drop unique index user.login", new(DropIndexMigration).
		Table("user").Columns("login").Unique())

	mg.AddMigration("drop unique index user.email", new(DropIndexMigration).
		Table("user").Columns("email").Unique())

	//------- rename table ------------------
	mg.AddMigration("rename table user to user_old", new(RenameTableMigration).
		Rename("user", "user_old"))

	//------- recreate table with new column names ------------------
	mg.AddMigration("create user table v2", new(AddTableMigration).
		Name("user").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "version", Type: DB_Int, Nullable: false},
		&Column{Name: "login", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "email", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "password", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "salt", Type: DB_NVarchar, Length: 50, Nullable: true},
		&Column{Name: "rands", Type: DB_NVarchar, Length: 50, Nullable: true},
		&Column{Name: "company", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "email_verified", Type: DB_Bool, Nullable: true},
		&Column{Name: "theme", Type: DB_NVarchar, Nullable: true},
		&Column{Name: "is_admin", Type: DB_Bool, Nullable: false},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	//-------  user table indexes ------------------
	mg.AddMigration("add unique index user.login v2", new(AddIndexMigration).
		Table("user").Columns("login").Unique())

	mg.AddMigration("add unique index user.email v2", new(AddIndexMigration).
		Table("user").Columns("email").Unique())

	//------- copy data from user_old table -------------------
	mg.AddMigration("copy data from user_old table", new(CopyTableDataMigration).
		Source("user_old", "id, version, login, email, name, password, salt, rands, company, account_id, is_admin, created, updated").
		Target("user", "id, version, login, email, name, password, salt, rands, company, org_id, is_admin, created, updated"))

	mg.AddMigration("Drop old table user_old", new(DropTableMigration).Table("user_old"))

}
