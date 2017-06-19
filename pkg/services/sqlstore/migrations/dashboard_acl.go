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
			{Name: "user_group_id", Type: DB_BigInt, Nullable: true},
			{Name: "permissions", Type: DB_SmallInt, Default: "4"},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"dashboard_id", "user_id"}, Type: UniqueIndex},
			{Cols: []string{"dashboard_id", "user_group_id"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create dashboard  acl table", NewAddTableMigration(dashboardAclV1))

	//-------  indexes ------------------
	mg.AddMigration("add unique index dashboard_acl_org_id", NewAddIndexMigration(dashboardAclV1, dashboardAclV1.Indices[0]))
	mg.AddMigration("add unique index dashboard_acl_dashboard_id_user_id", NewAddIndexMigration(dashboardAclV1, dashboardAclV1.Indices[1]))
	mg.AddMigration("add unique index dashboard_acl_dashboard_id_group_id", NewAddIndexMigration(dashboardAclV1, dashboardAclV1.Indices[2]))
}
