package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addPreferencesMigrations(mg *Migrator) {

	preferencesV1 := Table{
		Name: "preferences",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "pref_id", Type: DB_Int, Nullable: false},
			{Name: "pref_type", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "pref_data", Type: DB_Text, Nullable: false},
		},
	}

	// create table
	mg.AddMigration("create preferences table v1", NewAddTableMigration(preferencesV1))

}
