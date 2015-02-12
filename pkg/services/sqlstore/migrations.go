package sqlstore

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// --- Migration Guide line ---
// 1. Never change a migration that is committed and pushed to master
// 2. Always add new migrations (to change or undo previous migrations)
// 3. Some migraitons are not yet written (rename column, table, drop table, index etc)

func addMigrations(mg *Migrator) {
	addMigrationLogMigrations(mg)
	addUserMigrations(mg)
	addStarMigrations(mg)
	addAccountMigrations(mg)
	addDashboardMigration(mg)
	addDataSourceMigration(mg)
	addApiKeyMigrations(mg)
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
}

func addStarMigrations(mg *Migrator) {
	mg.AddMigration("create star table", new(AddTableMigration).
		Name("star").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "user_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
	))

	mg.AddMigration("add unique index star.user_id_dashboard_id", new(AddIndexMigration).
		Table("star").Columns("user_id", "dashboard_id").Unique())
}

func addAccountMigrations(mg *Migrator) {
	mg.AddMigration("create account table", new(AddTableMigration).
		Name("account").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "version", Type: DB_Int, Nullable: false},
		&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	mg.AddMigration("add unique index account.name", new(AddIndexMigration).
		Table("account").Columns("name").Unique())

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

	mg.AddMigration("add unique index account_user_aid_uid", new(AddIndexMigration).
		Name("aid_uid").Table("account_user").Columns("account_id", "user_id").Unique())
}

func addDashboardMigration(mg *Migrator) {
	mg.AddMigration("create dashboard table", new(AddTableMigration).
		Name("dashboard").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "version", Type: DB_Int, Nullable: false},
		&Column{Name: "slug", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
		&Column{Name: "data", Type: DB_Text, Nullable: false},
		&Column{Name: "account_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "created", Type: DB_DateTime, Nullable: false},
		&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
	))

	mg.AddMigration("create dashboard_tag table", new(AddTableMigration).
		Name("dashboard_tag").WithColumns(
		&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
		&Column{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
		&Column{Name: "term", Type: DB_NVarchar, Length: 50, Nullable: false},
	))

	//-------  indexes ------------------
	mg.AddMigration("add index dashboard.account_id", new(AddIndexMigration).
		Table("dashboard").Columns("account_id"))

	mg.AddMigration("add unique index dashboard_account_id_slug", new(AddIndexMigration).
		Table("dashboard").Columns("account_id", "slug").Unique())

	mg.AddMigration("add unique index dashboard_tag.dasboard_id_term", new(AddIndexMigration).
		Table("dashboard_tag").Columns("dashboard_id", "term").Unique())
}

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
}

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
}
