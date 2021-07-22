package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addDashboardAclMigrations(mg *Migrator) {
	dashboardAclV1 := Table{
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
		},
	}

	mg.AddMigration("create dashboard acl table", NewAddTableMigration(dashboardAclV1))

	//-------  indexes ------------------
	mg.AddMigration("add index dashboard_acl_dashboard_id", NewAddIndexMigration(dashboardAclV1, dashboardAclV1.Indices[0]))
	mg.AddMigration("add unique index dashboard_acl_dashboard_id_user_id", NewAddIndexMigration(dashboardAclV1, dashboardAclV1.Indices[1]))
	mg.AddMigration("add unique index dashboard_acl_dashboard_id_team_id", NewAddIndexMigration(dashboardAclV1, dashboardAclV1.Indices[2]))

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
		(-1,-1, 1,'Viewer','2017-06-20','2017-06-20'),
		(-1,-1, 2,'Editor','2017-06-20','2017-06-20')
	`

	mg.AddMigration("save default acl rules in dashboard_acl table", NewRawSQLMigration(rawSQL))

	mg.AddMigration("delete acl rules for deleted dashboards and folders", NewRawSQLMigration(
		"DELETE FROM dashboard_acl WHERE dashboard_id NOT IN (SELECT id FROM dashboard) AND dashboard_id != -1"))
}

// We now create these default rules as part of the sqlstore initialisation
func addCleanupDashboardACLRulesMigration(mg *Migrator) {
	// This query is really specific (including created/updated) because we only
	// want to delete rules that were created by the "save default acl rules in
	// dashboard_acl table" migration
	const rawSQL = `
		DELETE FROM dashboard_acl
			WHERE org_id=-1 AND
			dashboard_id=-1 AND
			user_id is NULL AND
			team_id is NULL AND
			permission IN (1,2)	AND
			role IN ('Viewer','Editor') AND
			created='2017-06-20' AND
			updated='2017-06-20'`
	mg.AddMigration("remove default acl rules from dashboard_acl table", NewRawSQLMigration(rawSQL))
}
