package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardACLMigrations(mg *Migrator) {
	dashboardACLV1 := Table{
		Name: "dashboard_acl",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt},
			{Name: "dashboard_id", Type: DB_BigInt},
			{Name: "user_id", Type: DB_BigInt, Nullable: true},
			{Name: "team_id", Type: DB_BigInt, Nullable: true},
			{Name: "permission", Type: DB_SmallInt, Default: "4"},
			{Name: "role", Type: DB_Varchar, Length: 20, Nullable: true},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"dashboard_id"}},
			{Cols: []string{"dashboard_id", "user_id"}, Type: UniqueIndex},
			{Cols: []string{"dashboard_id", "team_id"}, Type: UniqueIndex},
			{Cols: []string{"user_id"}},
			{Cols: []string{"team_id"}},
			{Cols: []string{"org_id", "role"}},
			{Cols: []string{"permission"}},
		},
	}

	mg.AddMigration("create dashboard acl table", NewAddTableMigration(dashboardACLV1))

	//-------  indexes ------------------
	mg.AddMigration("add index dashboard_acl_dashboard_id", NewAddIndexMigration(dashboardACLV1, dashboardACLV1.Indices[0]))
	mg.AddMigration("add unique index dashboard_acl_dashboard_id_user_id", NewAddIndexMigration(dashboardACLV1, dashboardACLV1.Indices[1]))
	mg.AddMigration("add unique index dashboard_acl_dashboard_id_team_id", NewAddIndexMigration(dashboardACLV1, dashboardACLV1.Indices[2]))
	mg.AddMigration("add index dashboard_acl_user_id", NewAddIndexMigration(dashboardACLV1, dashboardACLV1.Indices[3]))
	mg.AddMigration("add index dashboard_acl_team_id", NewAddIndexMigration(dashboardACLV1, dashboardACLV1.Indices[4]))
	mg.AddMigration("add index dashboard_acl_org_id_role", NewAddIndexMigration(dashboardACLV1, dashboardACLV1.Indices[5]))
	mg.AddMigration("add index dashboard_permission", NewAddIndexMigration(dashboardACLV1, dashboardACLV1.Indices[6]))

	const rawSQL = `
INSERT INTO dashboard_acl
	(
		org_id,
		dashboard_id,
		permission,
		role,
		created,
		updated
	)
	VALUES
		(-1,-1, 1,'Viewer',Date('2017-06-20'),Date('2017-06-20')),
		(-1,-1, 2,'Editor',Date('2017-06-20'),Date('2017-06-20'))
	`

	mg.AddMigration("save default acl rules in dashboard_acl table", NewRawSQLMigration(rawSQL))

	mg.AddMigration("delete acl rules for deleted dashboards and folders", NewRawSQLMigration(
		"DELETE FROM dashboard_acl WHERE dashboard_id NOT IN (SELECT id FROM dashboard) AND dashboard_id != -1"))
}
