package migrations

var migrationList []Migration

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

func init() {
	// ------------------------------
	addMigration(new(RawSqlMigration).Desc("Create account table").
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
	addMigration(new(AddIndexMigration).
		Name("UIX_account_login").Table("account").Columns("login"))
	// ------------------------------
	addMigration(new(AddColumnMigration).Desc("Add name column").
		Table("account").Column("name").Type(DB_TYPE_STRING).Length(255))
}

func addMigration(m Migration) {
	migrationList = append(migrationList, m)
}

type SchemaVersion struct {
	Version int
}

type SchemaLog struct {
	Id      int64
	Version int64
	Desc    string
	Info    string
	Error   bool
}
