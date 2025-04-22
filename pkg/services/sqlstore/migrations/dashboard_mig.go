package migrations

import (
	"fmt"

	"xorm.io/xorm"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addDashboardMigration(mg *Migrator) {
	var dashboardV1 = Table{
		Name: "dashboard",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "slug", Type: DB_NVarchar, Length: 189, Nullable: false},
			{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: false},
			{Name: "account_id", Type: DB_BigInt, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"account_id"}},
			{Cols: []string{"account_id", "slug"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create dashboard table", NewAddTableMigration(dashboardV1))

	//-------  indexes ------------------
	mg.AddMigration("add index dashboard.account_id", NewAddIndexMigration(dashboardV1, dashboardV1.Indices[0]))
	mg.AddMigration("add unique index dashboard_account_id_slug", NewAddIndexMigration(dashboardV1, dashboardV1.Indices[1]))

	dashboardTagV1 := Table{
		Name: "dashboard_tag",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: false},
			{Name: "term", Type: DB_NVarchar, Length: 50, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"dashboard_id", "term"}, Type: UniqueIndex},
		},
	}

	mg.AddMigration("create dashboard_tag table", NewAddTableMigration(dashboardTagV1))
	mg.AddMigration("add unique index dashboard_tag.dasboard_id_term", NewAddIndexMigration(dashboardTagV1, dashboardTagV1.Indices[0]))

	// ---------------------
	// account -> org changes

	//-------  drop dashboard indexes ------------------
	addDropAllIndicesMigrations(mg, "v1", dashboardTagV1)
	//------- rename table ------------------
	addTableRenameMigration(mg, "dashboard", "dashboard_v1", "v1")

	// dashboard v2
	var dashboardV2 = Table{
		Name: "dashboard",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "slug", Type: DB_NVarchar, Length: 189, Nullable: false},
			{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "created", Type: DB_DateTime, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "slug"}, Type: UniqueIndex},
		},
	}

	// recreate table
	mg.AddMigration("create dashboard v2", NewAddTableMigration(dashboardV2))
	// recreate indices
	addTableIndicesMigrations(mg, "v2", dashboardV2)
	// copy data
	mg.AddMigration("copy dashboard v1 to v2", NewCopyTableDataMigration("dashboard", "dashboard_v1", map[string]string{
		"id":      "id",
		"version": "version",
		"slug":    "slug",
		"title":   "title",
		"data":    "data",
		"org_id":  "account_id",
		"created": "created",
		"updated": "updated",
	}))

	mg.AddMigration("drop table dashboard_v1", NewDropTableMigration("dashboard_v1"))

	// change column type of dashboard.data
	mg.AddMigration("alter dashboard.data to mediumtext v1", NewRawSQLMigration("").
		Mysql("ALTER TABLE dashboard MODIFY data MEDIUMTEXT;"))

	// add column to store updater of a dashboard
	mg.AddMigration("Add column updated_by in dashboard - v2", NewAddColumnMigration(dashboardV2, &Column{
		Name: "updated_by", Type: DB_Int, Nullable: true,
	}))

	// add column to store creator of a dashboard
	mg.AddMigration("Add column created_by in dashboard - v2", NewAddColumnMigration(dashboardV2, &Column{
		Name: "created_by", Type: DB_Int, Nullable: true,
	}))

	// add column to store gnetId
	mg.AddMigration("Add column gnetId in dashboard", NewAddColumnMigration(dashboardV2, &Column{
		Name: "gnet_id", Type: DB_BigInt, Nullable: true,
	}))

	mg.AddMigration("Add index for gnetId in dashboard", NewAddIndexMigration(dashboardV2, &Index{
		Cols: []string{"gnet_id"}, Type: IndexType,
	}))

	// add column to store plugin_id
	mg.AddMigration("Add column plugin_id in dashboard", NewAddColumnMigration(dashboardV2, &Column{
		Name: "plugin_id", Type: DB_NVarchar, Nullable: true, Length: 189,
	}))

	mg.AddMigration("Add index for plugin_id in dashboard", NewAddIndexMigration(dashboardV2, &Index{
		Cols: []string{"org_id", "plugin_id"}, Type: IndexType,
	}))

	// dashboard_id index for dashboard_tag table
	mg.AddMigration("Add index for dashboard_id in dashboard_tag", NewAddIndexMigration(dashboardTagV1, &Index{
		Cols: []string{"dashboard_id"}, Type: IndexType,
	}))

	mg.AddMigration("Update dashboard table charset", NewTableCharsetMigration("dashboard", []*Column{
		{Name: "slug", Type: DB_NVarchar, Length: 189, Nullable: false},
		{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
		{Name: "plugin_id", Type: DB_NVarchar, Nullable: true, Length: 189},
		{Name: "data", Type: DB_MediumText, Nullable: false},
	}))

	mg.AddMigration("Update dashboard_tag table charset", NewTableCharsetMigration("dashboard_tag", []*Column{
		{Name: "term", Type: DB_NVarchar, Length: 50, Nullable: false},
	}))

	// add column to store folder_id for dashboard folder structure
	mg.AddMigration("Add column folder_id in dashboard", NewAddColumnMigration(dashboardV2, &Column{
		Name: "folder_id", Type: DB_BigInt, Nullable: false, Default: "0",
	}))

	mg.AddMigration("Add column isFolder in dashboard", NewAddColumnMigration(dashboardV2, &Column{
		Name: "is_folder", Type: DB_Bool, Nullable: false, Default: "0",
	}))

	// add column to flag if dashboard has an ACL
	mg.AddMigration("Add column has_acl in dashboard", NewAddColumnMigration(dashboardV2, &Column{
		Name: "has_acl", Type: DB_Bool, Nullable: false, Default: "0",
	}))

	mg.AddMigration("Add column uid in dashboard", NewAddColumnMigration(dashboardV2, &Column{
		Name: "uid", Type: DB_NVarchar, Length: 40, Nullable: true,
	}))

	mg.AddMigration("Update uid column values in dashboard", NewRawSQLMigration("").
		SQLite("UPDATE dashboard SET uid=printf('%09d',id) WHERE uid IS NULL;").
		Postgres("UPDATE dashboard SET uid=lpad('' || id::text,9,'0') WHERE uid IS NULL;").
		Mysql("UPDATE dashboard SET uid=lpad(id,9,'0') WHERE uid IS NULL;"))

	mg.AddMigration("Add unique index dashboard_org_id_uid", NewAddIndexMigration(dashboardV2, &Index{
		Cols: []string{"org_id", "uid"}, Type: UniqueIndex,
	}))

	mg.AddMigration("Remove unique index org_id_slug", NewDropIndexMigration(dashboardV2, &Index{
		Cols: []string{"org_id", "slug"}, Type: UniqueIndex,
	}))

	mg.AddMigration("Update dashboard title length", NewTableCharsetMigration("dashboard", []*Column{
		{Name: "title", Type: DB_NVarchar, Length: 189, Nullable: false},
	}))

	// This gets removed later in AddDashboardFolderMigrations
	mg.AddMigration("Add unique index for dashboard_org_id_title_folder_id", NewAddIndexMigration(dashboardV2, &Index{
		Cols: []string{"org_id", "folder_id", "title"}, Type: UniqueIndex,
	}))

	dashboardExtrasTable := Table{
		Name: "dashboard_provisioning",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: true},
			{Name: "name", Type: DB_NVarchar, Length: 150, Nullable: false},
			{Name: "external_id", Type: DB_Text, Nullable: false},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{},
	}

	mg.AddMigration("create dashboard_provisioning", NewAddTableMigration(dashboardExtrasTable))

	dashboardExtrasTableV2 := Table{
		Name: "dashboard_provisioning",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "dashboard_id", Type: DB_BigInt, Nullable: true},
			{Name: "name", Type: DB_NVarchar, Length: 150, Nullable: false},
			{Name: "external_id", Type: DB_Text, Nullable: false},
			{Name: "updated", Type: DB_Int, Default: "0", Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"dashboard_id"}},
			{Cols: []string{"dashboard_id", "name"}, Type: IndexType},
		},
	}

	addTableReplaceMigrations(mg, dashboardExtrasTable, dashboardExtrasTableV2, 2, map[string]string{
		"id":           "id",
		"dashboard_id": "dashboard_id",
		"name":         "name",
		"external_id":  "external_id",
	})

	mg.AddMigration("Add check_sum column", NewAddColumnMigration(dashboardExtrasTableV2, &Column{
		Name: "check_sum", Type: DB_NVarchar, Length: 32, Nullable: true,
	}))
	mg.AddMigration("Add index for dashboard_title", NewAddIndexMigration(dashboardV2, &Index{
		Cols: []string{"title"},
		Type: IndexType,
	}))

	mg.AddMigration("delete tags for deleted dashboards", NewRawSQLMigration(
		"DELETE FROM dashboard_tag WHERE dashboard_id NOT IN (SELECT id FROM dashboard)"))

	mg.AddMigration("delete stars for deleted dashboards", NewRawSQLMigration(
		"DELETE FROM star WHERE dashboard_id NOT IN (SELECT id FROM dashboard)"))

	mg.AddMigration("Add index for dashboard_is_folder", NewAddIndexMigration(dashboardV2, &Index{
		Cols: []string{"is_folder"},
		Type: IndexType,
	}))

	mg.AddMigration("Add isPublic for dashboard", NewAddColumnMigration(dashboardV2, &Column{
		Name: "is_public", Type: DB_Bool, Nullable: false, Default: "0",
	}))

	mg.AddMigration("Add deleted for dashboard", NewAddColumnMigration(dashboardV2, &Column{
		Name: "deleted", Type: DB_DateTime, Nullable: true,
	}))

	mg.AddMigration("Add index for deleted", NewAddIndexMigration(dashboardV2, &Index{
		Cols: []string{"deleted"},
		Type: IndexType,
	}))

	mg.AddMigration("Add column dashboard_uid in dashboard_tag", NewAddColumnMigration(dashboardTagV1, &Column{
		Name: "dashboard_uid", Type: DB_NVarchar, Length: 40, Nullable: true,
	}))
	mg.AddMigration("Add column org_id in dashboard_tag", NewAddColumnMigration(dashboardTagV1, &Column{
		Name: "org_id", Type: DB_BigInt, Nullable: true, Default: "1",
	}))

	mg.AddMigration("Add missing dashboard_uid and org_id to dashboard_tag", &FillDashbordUIDAndOrgIDMigration{})

	mg.AddMigration("Add apiVersion for dashboard", NewAddColumnMigration(dashboardV2, &Column{
		Name: "api_version", Type: DB_Varchar, Length: 16, Nullable: true,
	}))

	mg.AddMigration("Add index for dashboard_uid on dashboard_tag table", NewAddIndexMigration(dashboardTagV1, &Index{
		Cols: []string{"dashboard_uid"},
		Type: IndexType,
	}))
}

type FillDashbordUIDAndOrgIDMigration struct {
	MigrationBase
}

func (m *FillDashbordUIDAndOrgIDMigration) SQL(dialect Dialect) string {
	return "code migration"
}

func (m *FillDashbordUIDAndOrgIDMigration) Exec(sess *xorm.Session, mg *Migrator) error {
	return RunDashboardTagMigrations(sess, mg.Dialect.DriverName())
}

func RunDashboardTagMigrations(sess *xorm.Session, driverName string) error {
	// sqlite
	sql := `UPDATE dashboard_tag
	SET
    	dashboard_uid = (SELECT uid FROM dashboard WHERE dashboard.id = dashboard_tag.dashboard_id),
    	org_id = (SELECT org_id FROM dashboard WHERE dashboard.id = dashboard_tag.dashboard_id)
	WHERE
    	(dashboard_uid IS NULL OR org_id IS NULL)
    	AND EXISTS (SELECT 1 FROM dashboard WHERE dashboard.id = dashboard_tag.dashboard_id);`
	switch driverName {
	case Postgres:
		sql = `UPDATE dashboard_tag
		SET dashboard_uid = dashboard.uid,
			org_id = dashboard.org_id
		FROM dashboard
		WHERE dashboard_tag.dashboard_id = dashboard.id
			AND (dashboard_tag.dashboard_uid IS NULL OR dashboard_tag.org_id IS NULL);`
	case MySQL:
		sql = `UPDATE dashboard_tag
		LEFT JOIN dashboard ON dashboard_tag.dashboard_id = dashboard.id
		SET dashboard_tag.dashboard_uid = dashboard.uid,
			dashboard_tag.org_id = dashboard.org_id
		WHERE dashboard_tag.dashboard_uid IS NULL OR dashboard_tag.org_id IS NULL;`
	}

	if _, err := sess.Exec(sql); err != nil {
		return fmt.Errorf("failed to set dashboard_uid and org_id in dashboard_tag: %w", err)
	}

	return nil
}
