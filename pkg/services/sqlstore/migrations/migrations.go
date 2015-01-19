package migrations

import "time"

func AddMigrations(mg *Migrator) {

	//-------  migration_log table -------------------
	mg.AddMigration("create migration_log table", new(AddTableMigration).
		Name("migration_log").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "migration_id", Type: DB_NVarchar, Length: 255},
		&Column{Name: "sql", Type: DB_Text},
		&Column{Name: "success", Type: DB_Bool},
		&Column{Name: "error", Type: DB_Text},
		&Column{Name: "timestamp", Type: DB_DateTime},
	))

	//-------  user table -------------------
	mg.AddMigration("create user table", new(AddTableMigration).
		Name("user").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "login", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "email", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "password", Type: DB_NVarchar, Length: 50, Nullable: true},
		&Column{Name: "salt", Type: DB_NVarchar, Length: 50, Nullable: true},
		&Column{Name: "company", Type: DB_NVarchar, Length: 255, Nullable: true},
		&Column{Name: "account_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "is_admin", Type: DB_Bool, Nullable: false},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	//-------  account2 table -------------------
	mg.AddMigration("create account2 table", new(AddTableMigration).
		Name("account2").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "name", Type: DB_NVarchar, Length: 255},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	mg.AddMigration("add unique index UIX_account.name", new(AddIndexMigration).
		Name("UIX_account_name").Table("account2").Columns("name"))

	//-------  account_user table -------------------
	mg.AddMigration("create account_user table", new(AddTableMigration).
		Name("account_user").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "account_id", Type: DB_BigInt},
		&Column{Name: "user_id", Type: DB_BigInt},
		&Column{Name: "role", Type: DB_NVarchar, Length: 20},
		&Column{Name: "created", Type: DB_DateTime},
		&Column{Name: "updated", Type: DB_DateTime},
	))

	mg.AddMigration("add unique index UIX_account_user", new(AddIndexMigration).
		Name("UIX_account_user").Table("account_user").Columns("account_id", "user_id"))

	//-------  account table -------------------
	mg.AddMigration("create account table", new(AddTableMigration).
		Name("account").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "login", Type: DB_NVarchar, Length: 255},
		&Column{Name: "email", Type: DB_NVarchar, Length: 255},
		&Column{Name: "name", Type: DB_NVarchar, Length: 255},
		&Column{Name: "password", Type: DB_NVarchar, Length: 50},
		&Column{Name: "salt", Type: DB_NVarchar, Length: 50},
		&Column{Name: "company", Type: DB_NVarchar, Length: 255},
		&Column{Name: "using_account_id", Type: DB_BigInt},
		&Column{Name: "is_admin", Type: DB_Bool},
		&Column{Name: "created", Type: DB_DateTime},
		&Column{Name: "updated", Type: DB_DateTime},
	))

	//-------  account table indexes ------------------
	mg.AddMigration("add unique index UIX_account.login", new(AddIndexMigration).
		Name("UIX_account_login").Table("account").Columns("login"))
	mg.AddMigration("add unique index UIX_account.email", new(AddIndexMigration).
		Name("UIX_account_email").Table("account").Columns("email"))
}

type MigrationLog struct {
	Id          int64
	MigrationId string
	Sql         string
	Success     bool
	Error       string
	Timestamp   time.Time
}
