package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addPreferencesMigrations(mg *Migrator) {

	preferencesV1 := Table{
		Name: "preferences",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_Int, Nullable: false},
			{Name: "user_id", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "preference", Type: DB_Text, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
	}

	// create table
	mg.AddMigration("create preferences table v1", NewAddTableMigration(preferencesV1))

}
