package migrations

import . "github.com/wangy1931/grafana/pkg/services/sqlstore/migrator"

func addUserMigrations(mg *Migrator) {
	userV1 := Table{
		Name: "user",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "login", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "email", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "password", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "salt", Type: DB_NVarchar, Length: 50, Nullable: true},
			{Name: "rands", Type: DB_NVarchar, Length: 50, Nullable: true},
			{Name: "company", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "account_id", Type: DB_BigInt, Nullable: false},
			{Name: "is_admin", Type: DB_Bool, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"login"}, Type: UniqueIndex},
			{Cols: []string{"email"}, Type: UniqueIndex},
		},
	}

	// create table
	mg.AddMigration("create user table", NewAddTableMigration(userV1))
	// add indices
	mg.AddMigration("add unique index user.login", NewAddIndexMigration(userV1, userV1.Indices[0]))
	mg.AddMigration("add unique index user.email", NewAddIndexMigration(userV1, userV1.Indices[1]))

	// ---------------------
	// account -> org changes

	//-------  drop indexes ------------------
	addDropAllIndicesMigrations(mg, "v1", userV1)

	//------- rename table ------------------
	addTableRenameMigration(mg, "user", "user_v1", "v1")

	//------- recreate table with new column names ------------------
	userV2 := Table{
		Name: "user",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "login", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "email", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "password", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "salt", Type: DB_NVarchar, Length: 50, Nullable: true},
			{Name: "rands", Type: DB_NVarchar, Length: 50, Nullable: true},
			{Name: "company", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "is_admin", Type: DB_Bool, Nullable: false},
			{Name: "email_verified", Type: DB_Bool, Nullable: true},
			{Name: "theme", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"login"}, Type: UniqueIndex},
			{Cols: []string{"email"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create user table v2", NewAddTableMigration(userV2))
	addTableIndicesMigrations(mg, "v2", userV2)

	//------- copy data from v1 to v2 -------------------
	mg.AddMigration("copy data_source v1 to v2", NewCopyTableDataMigration("user", "user_v1", map[string]string{
		"id":       "id",
		"version":  "version",
		"login":    "login",
		"email":    "email",
		"name":     "name",
		"password": "password",
		"salt":     "salt",
		"rands":    "rands",
		"company":  "company",
		"org_id":   "account_id",
		"is_admin": "is_admin",
		"created":  "created",
		"updated":  "updated",
	}))

	mg.AddMigration("Drop old table user_v1", NewDropTableMigration("user_v1"))
}
