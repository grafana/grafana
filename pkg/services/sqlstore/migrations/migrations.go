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
