package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addTempUserMigrations(mg *Migrator) {
	tempUserV1 := Table{
		Name: "temp_user",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "email", Type: DB_NVarchar, Length: 255},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "role", Type: DB_NVarchar, Length: 20, Nullable: true},
			{Name: "code", Type: DB_NVarchar, Length: 255},
			{Name: "is_invite", Type: DB_Bool},
			{Name: "invited_by_user_id", Type: DB_BigInt, Nullable: true},
			{Name: "email_sent", Type: DB_Bool},
			{Name: "email_sent_on", Type: DB_DateTime, Nullable: true},
			{Name: "created", Type: DB_DateTime},
			{Name: "updated", Type: DB_DateTime},
		},
		Indices: []*Index{
			{Cols: []string{"email"}, Type: IndexType},
			{Cols: []string{"org_id"}, Type: IndexType},
			{Cols: []string{"code"}, Type: IndexType},
		},
	}

	// create table
	mg.AddMigration("create temp user table v1-3", NewAddTableMigration(tempUserV1))

	addTableIndicesMigrations(mg, "v1-3", tempUserV1)
}
