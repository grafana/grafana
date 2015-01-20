package migrations

import "time"

func AddMigrations(mg *Migrator) {
	addMigrationLogMigrations(mg)
	addUserMigrations(mg)
	addAccountMigrations(mg)
	addDashboardMigration(mg)
}

func addMigrationLogMigrations(mg *Migrator) {
	mg.AddMigration("create migration_log table", new(AddTableMigration).
		Name("migration_log").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "migration_id", Type: DB_NVarchar, Length: 255},
		&Column{Name: "sql", Type: DB_Text},
		&Column{Name: "success", Type: DB_Bool},
		&Column{Name: "error", Type: DB_Text},
		&Column{Name: "timestamp", Type: DB_DateTime},
	))
}

func addUserMigrations(mg *Migrator) {
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

	//-------  user table indexes ------------------
	mg.AddMigration("add unique index UIX_user.login", new(AddIndexMigration).
		Name("UIX_user_login").Table("user").Columns("login"))
	mg.AddMigration("add unique index UIX_user.email", new(AddIndexMigration).
		Name("UIX_user_email").Table("user").Columns("email"))
}

func addAccountMigrations(mg *Migrator) {
	mg.AddMigration("create account table", new(AddTableMigration).
		Name("account").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	mg.AddMigration("add unique index UIX_account.name", new(AddIndexMigration).
		Name("UIX_account_name").Table("account").Columns("name"))

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
}

type Dashboard struct {
	Id        int64
	Slug      string `xorm:"index(IX_AccountIdSlug)"`
	AccountId int64  `xorm:"index(IX_AccountIdSlug)"`

	Created time.Time
	Updated time.Time

	Title string
	Data  map[string]interface{}
}

func addDashboardMigration(mg *Migrator) {
	mg.AddMigration("create dashboard table", new(AddTableMigration).
		Name("dashboard").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "data", Type: DB_Text, Nullable: false},
		&Column{Name: "account_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	//-------  indexes ------------------
	mg.AddMigration("add unique index UIX_dashboard.account_id", new(AddIndexMigration).
		Name("UIX_dashboard_account_id").Table("dashboard").Columns("account_id"))

	mg.AddMigration("add unique index UIX_dashboard_account_id_slug", new(AddIndexMigration).
		Name("UIX_dashboard_account_id_slug").Table("dashboard").Columns("account_id", "slug"))
}
