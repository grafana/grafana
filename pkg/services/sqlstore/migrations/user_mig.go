package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addUserMigrations(mg *Migrator) {
	userV1 := Table{
		Name: "user",
		Columns: []*Column{
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
		},
		Indices: []*Index{
			&Index{Cols: []string{"login"}, Type: UniqueIndex},
			&Index{Cols: []string{"email"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create user table", NewAddTableMigration(userV1))

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
	addDropAllIndicesMigrations(mg, "v1", userV1)

	//------- rename table ------------------
	addTableRenameMigration(mg, "user", "user_v1", "v1")

	//------- recreate table with new column names ------------------
	userV2 := Table{
		Name: "user",
		Columns: []*Column{
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
			&Column{Name: "is_admin", Type: DB_Bool, Nullable: false},
			&Column{Name: "email_verified", Type: DB_Bool, Nullable: true},
			&Column{Name: "theme", Type: DB_NVarchar, Nullable: true},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"login"}, Type: UniqueIndex},
			&Index{Cols: []string{"email"}, Type: UniqueIndex},
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
