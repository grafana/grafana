package migrations

import "time"

// Id              int64
// Login           string `xorm:"UNIQUE NOT NULL"`
// Email           string `xorm:"UNIQUE NOT NULL"`
// Name            string
// FullName        string
// Password        string
// IsAdmin         bool
// Salt            string `xorm:"VARCHAR(10)"`
// Company         string
// NextDashboardId int
// UsingAccountId  int64
// Created         time.Time
// Updated         time.Time

func AddMigrations(mg *Migrator) {

	// TABLE Account
	// -------------------------------
	mg.AddMigration("create account table", new(RawSqlMigration).
		Sqlite(`
		  CREATE TABLE account (
		  	id INTEGER PRIMARY KEY AUTOINCREMENT,
		  	login TEXT NOT NULL,
		  	email TEXT NOT NULL
			)
		`).
		Mysql(`
		  CREATE TABLE account (
		  	id BIGINT NOT NULL AUTO_INCREMENT, PRIMARY KEY (id),
		  	login  VARCHAR(255) NOT NULL,
		  	email  VARCHAR(255) NOT NULL
		  )
		`))
	// ------------------------------
	mg.AddMigration("add index UIX_account.login", new(AddIndexMigration).
		Name("UIX_account_login").Table("account").Columns("login"))
	// ------------------------------
	mg.AddMigration("add column", new(AddColumnMigration).
		Table("account").Column("name").Type(DB_TYPE_STRING).Length(255))
}

type MigrationLog struct {
	Id          int64
	MigrationId string
	Sql         string
	Success     bool
	Error       string
	Timestamp   time.Time
}
