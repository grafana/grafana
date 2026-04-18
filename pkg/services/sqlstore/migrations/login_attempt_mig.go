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
		Mysql("ALTER TABLE login_attempt MODIFY ip_address VARCHAR(50);"))

	// Use bigint for "created" column to store timestamps (INT is too small)
	mg.AddMigration("alter table login_attempt alter column created type to bigint", NewRawSQLMigration("").
		Mysql("ALTER TABLE login_attempt MODIFY created BIGINT;").
		Postgres("ALTER TABLE login_attempt ALTER COLUMN created TYPE BIGINT;"))
}
