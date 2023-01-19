package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addPreferencesMigrations(mg *Migrator) {
	mg.AddMigration("drop preferences table v2", NewDropTableMigration("preferences"))

	preferencesV2 := Table{
		Name: "preferences",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "user_id", Type: DB_BigInt, Nullable: false},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "home_dashboard_id", Type: DB_BigInt, Nullable: false},
			{Name: "timezone", Type: DB_NVarchar, Length: 50, Nullable: false},
			{Name: "theme", Type: DB_NVarchar, Length: 20, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"user_id"}},
		},
	}

	mg.AddMigration("drop preferences table v3", NewDropTableMigration("preferences"))

	// create table
	mg.AddMigration("create preferences table v3", NewAddTableMigration(preferencesV2))

	mg.AddMigration("Update preferences table charset", NewTableCharsetMigration("preferences", []*Column{
		{Name: "timezone", Type: DB_NVarchar, Length: 50, Nullable: false},
		{Name: "theme", Type: DB_NVarchar, Length: 20, Nullable: false},
	}))

	mg.AddMigration("Add column team_id in preferences", NewAddColumnMigration(preferencesV2, &Column{
		Name: "team_id", Type: DB_BigInt, Nullable: true,
	}))

	mg.AddMigration("Update team_id column values in preferences", NewRawSQLMigration("").
		SQLite("UPDATE preferences SET team_id=0 WHERE team_id IS NULL;").
		Postgres("UPDATE preferences SET team_id=0 WHERE team_id IS NULL;").
		Mysql("UPDATE preferences SET team_id=0 WHERE team_id IS NULL;"))

	mg.AddMigration("Add column week_start in preferences", NewAddColumnMigration(preferencesV2, &Column{
		Name: "week_start", Type: DB_NVarchar, Length: 10, Nullable: true,
	}))

	mg.AddMigration("Add column preferences.json_data", NewAddColumnMigration(preferencesV2, &Column{
		Name: "json_data", Type: DB_Text, Nullable: true,
	}))
	// change column type of preferences.json_data
	mg.AddMigration("alter preferences.json_data to mediumtext v1", NewRawSQLMigration("").
		Mysql("ALTER TABLE preferences MODIFY json_data MEDIUMTEXT;"))

	mg.AddMigration("Add preferences index org_id", NewAddIndexMigration(preferencesV2, preferencesV2.Indices[0]))
	mg.AddMigration("Add preferences index user_id", NewAddIndexMigration(preferencesV2, preferencesV2.Indices[1]))
}
