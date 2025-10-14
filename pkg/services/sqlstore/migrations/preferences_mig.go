package migrations

import (
	"fmt"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
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

	mg.AddMigration("Add home_dashboard_uid column to preferences table", NewAddColumnMigration(preferencesV2, &Column{
		Name: "home_dashboard_uid", Type: DB_NVarchar, Length: 40, Nullable: true,
	}))

	mg.AddMigration("Add missing dashboard_uid to preferences table", &AddDashboardUIDMigration{})
}

type AddDashboardUIDMigration struct {
	MigrationBase
}

func (m *AddDashboardUIDMigration) SQL(dialect Dialect) string {
	return "code migration"
}

func (m *AddDashboardUIDMigration) Exec(sess *xorm.Session, mg *Migrator) error {
	return RunPreferencesMigration(sess, mg.Dialect.DriverName())
}

func RunPreferencesMigration(sess *xorm.Session, driverName string) error {
	// sqlite
	sql := `UPDATE preferences
	SET home_dashboard_uid = (SELECT uid FROM dashboard WHERE dashboard.id = preferences.home_dashboard_id)
	WHERE home_dashboard_uid IS NULL AND EXISTS (SELECT 1 FROM dashboard WHERE dashboard.id = preferences.home_dashboard_id);`
	switch driverName {
	case Postgres:
		sql = `UPDATE preferences
		SET home_dashboard_uid = dashboard.uid
		FROM dashboard
		WHERE preferences.home_dashboard_id = dashboard.id
			AND (preferences.home_dashboard_uid IS NULL);`
	case MySQL:
		sql = `UPDATE preferences
		LEFT JOIN dashboard ON preferences.home_dashboard_id = dashboard.id
		SET preferences.home_dashboard_uid = dashboard.uid
		WHERE preferences.home_dashboard_uid IS NULL;`
	case YDB:
		return nil
	}

	if _, err := sess.Exec(sql); err != nil {
		return fmt.Errorf("failed to set home_dashboard_uid for preferences: %w", err)
	}

	return nil
}
