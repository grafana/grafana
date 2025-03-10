package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardVersionMigration(mg *Migrator) {
	dashboardVersionV1 := Table{
		Name: "dashboard_version",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "dashboard_id", Type: DB_BigInt},
			{Name: "parent_version", Type: DB_Int, Nullable: false},
			{Name: "restored_from", Type: DB_Int, Nullable: false},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "created_by", Type: DB_BigInt, Nullable: false},
			{Name: "message", Type: DB_Text, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"dashboard_id"}},
			{Cols: []string{"dashboard_id", "version"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create dashboard_version table v1", NewAddTableMigration(dashboardVersionV1))
	mg.AddMigration("add index dashboard_version.dashboard_id", NewAddIndexMigration(dashboardVersionV1, dashboardVersionV1.Indices[0]))
	mg.AddMigration("add unique index dashboard_version.dashboard_id and dashboard_version.version", NewAddIndexMigration(dashboardVersionV1, dashboardVersionV1.Indices[1]))

	// before new dashboards where created with version 0, now they are always inserted with version 1
	const setVersionTo1WhereZeroSQL = `UPDATE dashboard SET version = 1 WHERE version = 0`
	mg.AddMigration("Set dashboard version to 1 where 0", NewRawSQLMigration(setVersionTo1WhereZeroSQL))

	const rawSQL = `INSERT INTO dashboard_version
(
	dashboard_id,
	version,
	parent_version,
	restored_from,
	created,
	created_by,
	message,
	data
)
SELECT
	dashboard.id,
	dashboard.version,
	dashboard.version,
	dashboard.version,
	dashboard.updated,
	COALESCE(dashboard.updated_by, -1),
	'',
	dashboard.data
FROM dashboard;`
	mg.AddMigration("save existing dashboard data in dashboard_version table v1", NewRawSQLMigration(rawSQL))

	// change column type of dashboard_version.data
	mg.AddMigration("alter dashboard_version.data to mediumtext v1", NewRawSQLMigration("").
		Mysql("ALTER TABLE dashboard_version MODIFY data MEDIUMTEXT;"))

	mg.AddMigration("Add apiVersion for dashboard_version", NewAddColumnMigration(dashboardVersionV1, &Column{
		Name: "api_version", Type: DB_Varchar, Length: 16, Nullable: true,
	}))
}
