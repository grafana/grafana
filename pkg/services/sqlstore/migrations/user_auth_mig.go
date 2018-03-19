package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addUserAuthMigrations(mg *Migrator) {
	userAuthV1 := Table{
		Name: "user_auth",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "auth_module", Type: DB_NVarchar, Length: 190, Nullable: false},
			{Name: "auth_id", Type: DB_NVarchar, Length: 100, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"auth_module", "auth_id"}},
		},
	}

	// create table
	mg.AddMigration("create user auth table", NewAddTableMigration(userAuthV1))
	// add indices
	addTableIndicesMigrations(mg, "v1", userAuthV1)
}
