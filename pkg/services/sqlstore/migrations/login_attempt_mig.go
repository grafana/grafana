package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addLoginAttemptMigrations(mg *Migrator) {
	loginAttemptV1 := Table{
		Name: "login_attempt",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "username", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "ip_address", Type: DB_NVarchar, Length: 30, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"username"}},
		},
	}

	// create table
	mg.AddMigration("create login attempt table", NewAddTableMigration(loginAttemptV1))
	// add indices
	mg.AddMigration("add index login_attempt.username", NewAddIndexMigration(loginAttemptV1, loginAttemptV1.Indices[0]))

	loginAttemptV2 := Table{
		Name: "login_attempt",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "username", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "ip_address", Type: DB_NVarchar, Length: 30, Nullable: false},
			{Name: "created", Type: DB_Int, Default: "0", Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"username"}},
		},
	}

	addTableReplaceMigrations(mg, loginAttemptV1, loginAttemptV2, 2, map[string]string{
		"id":         "id",
		"username":   "username",
		"ip_address": "ip_address",
	})

	// Increase ip_address column length to support IPv6 addresses
	mg.AddMigration("increase login_attempt.ip_address column length for IPv6 support", NewRawSQLMigration("").
		Postgres("ALTER TABLE login_attempt ALTER COLUMN ip_address TYPE VARCHAR(50);").
		Mysql("ALTER TABLE login_attempt MODIFY ip_address VARCHAR(50);").
		SQLite(`CREATE TABLE login_attempt_temp (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username VARCHAR(190) NOT NULL,
			ip_address VARCHAR(50) NOT NULL,
			created INTEGER DEFAULT 0 NOT NULL
		);
		INSERT INTO login_attempt_temp(id, username, ip_address, created)
		SELECT id, username, ip_address, created FROM login_attempt;
		DROP TABLE login_attempt;
		ALTER TABLE login_attempt_temp RENAME TO login_attempt;
		CREATE INDEX IDX_login_attempt_username ON login_attempt(username);`))
}
