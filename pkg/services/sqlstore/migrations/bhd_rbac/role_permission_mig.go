/*
 * Copyright (C) 2023-2025 BMC Helix Inc
 * Added by abjadhav at 10/16/2023
 */

package mig_rbac

import (
	"fmt"
	"strings"

	mig "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func AddRolePermissionRbacTable(mg *mig.Migrator) {
	BHDRolePermissionTableV1 := mig.Table{
		Name: "bhd_role_permission",
		Columns: []*mig.Column{
			{Name: "bhd_role_id", Type: mig.DB_BigInt, IsPrimaryKey: true, Nullable: false},
			{Name: "bhd_permission_name", Type: mig.DB_Text, IsPrimaryKey: true, Nullable: false},
			{Name: "org_id", Type: mig.DB_BigInt, IsPrimaryKey: true, Nullable: false},
		},
		Indices: []*mig.Index{
			{
				Name: "bhd_role_permission",
				Cols: []string{"bhd_role_id", "bhd_permission_name"},
				Type: mig.UniqueIndex,
			},
		},
	}
	mg.AddMigration("bhd: create bhd_role_permission table v1", mig.NewAddTableMigration(BHDRolePermissionTableV1))
	mg.AddMigration("bhd: alter table bhd_role_permission create index bhd_role_permission", mig.NewAddIndexMigration(BHDRolePermissionTableV1, BHDRolePermissionTableV1.Indices[0]))

	rawSQL := `ALTER TABLE bhd_role_permission ADD CONSTRAINT bhd_role_permission_permission_name_fkey FOREIGN KEY (bhd_permission_name) REFERENCES bhd_permission(name) ON DELETE CASCADE;`
	mg.AddMigration("bhd: alter table bhd_role_permission to add team_id FOREIGN KEY constraints", mig.NewRawSQLMigration(rawSQL))

	rawSQL = `ALTER TABLE bhd_role_permission ADD CONSTRAINT bhd_role_permission_bhd_role_id_fkey FOREIGN KEY (bhd_role_id) REFERENCES bhd_role(bhd_role_id) ON DELETE CASCADE;`
	mg.AddMigration("bhd: alter table bhd_role_permission to add role_id FOREIGN KEY constraints", mig.NewRawSQLMigration(rawSQL))

	rawSQL = addDefaultPermissionForBuiltInRole(1, BhdBuiltInAdminPermissions)
	mg.AddMigration("bhd: insert default permissions for builtin role Admin", mig.NewRawSQLMigration(rawSQL))

	rawSQL = addDefaultPermissionForBuiltInRole(2, BhdBuiltInEditorPermissions)
	mg.AddMigration("bhd: insert default permissions for builtin role Editor", mig.NewRawSQLMigration(rawSQL))

	rawSQL = addDefaultPermissionForBuiltInRole(3, BhdBuiltInViewerPermissions)
	mg.AddMigration("bhd: insert default permissions for builtin role Viewer", mig.NewRawSQLMigration(rawSQL))

	rawSQL = `DELETE FROM bhd_role_permission WHERE bhd_permission_name IN ('reports.history:read', 'reports.settings:read') AND bhd_role_id = 2`
	mg.AddMigration("bhd: remove report settings and history permissions for builtIn role Editor", mig.NewRawSQLMigration(rawSQL))

	rawSQL = `DELETE FROM bhd_permission WHERE name IN ('administration.folder:manage', 'administration.dashboards:manage')`
	mg.AddMigration("bhd: remove administration dashboards and folders permissions", mig.NewRawSQLMigration(rawSQL))

	//Fix for DRJ71-13623 : start
	var bhdDashboardDownloadPermissions = []BhdRolePermission{
		{"Dashboards", "dashboards:download", "Download", "can download dashboard as pdf/xlsx/csv", false},
	}
	rawSQL = addDefaultPermissionForBuiltInRole(3, bhdDashboardDownloadPermissions)
	mg.AddMigration("bhd: insert dashboard download permissions for builtin role Viewer", mig.NewRawSQLMigration(rawSQL))

	//Fix for DRJ71-13623 : End

	var newInsightFinderPermissions = []BhdRolePermission{
		{"Insight Finder", "insightfinder:access", "Access", "can access insight finder", true},
		{"Insight Finder", "insightfinder.dashboards:create", "Create dashboards", "can create dashboards through insight finder", true},
	}

	rawSQL = addDefaultPermissionForBuiltInRole(1, newInsightFinderPermissions)
	mg.AddMigration("bhd: insert insight finder as default permissions for builtin role Admin", mig.NewRawSQLMigration(rawSQL))

	var newDynamicRecipientPermissions = []BhdRolePermission{{"Reports", "reports.dynamic.recipients:access", "Dynamic recipients", "Can add recipients dynamically from dashboard in schedule", true}}
	rawSQL = addDefaultPermissionForBuiltInRole(1, newDynamicRecipientPermissions)
	mg.AddMigration("bhd: insert dynamic recipient as default permissions for builtin role Admin", mig.NewRawSQLMigration(rawSQL))

}

func addDefaultPermissionForBuiltInRole(roleID int64, permissions []BhdRolePermission) string {
	rawSQL := `INSERT INTO bhd_role_permission(bhd_role_id, bhd_permission_name, org_id) VALUES`
	values := make([]string, 0)
	for _, permission := range permissions {
		value := fmt.Sprintf("(%d, '%s', 1)",
			roleID,
			permission.Permission,
		)
		values = append(values, value)
	}
	permissionValues := strings.Join(values, ", ")
	rawSQL = rawSQL + " " + permissionValues
	return rawSQL
}

func CreateRoleRbacTrigger(mg *mig.Migrator) {
	rawSQL := `CREATE OR REPLACE FUNCTION insert_default_bhd_role_permission()
	RETURNS TRIGGER AS $$
	BEGIN
		INSERT INTO bhd_role_permission (bhd_role_id, bhd_permission_name, org_id)
		SELECT NEW.bhd_role_id, name, NEW.org_id
		FROM bhd_permission
		WHERE default_permission = TRUE;

    	RETURN NEW;
	END;
	$$ LANGUAGE plpgsql;

	CREATE TRIGGER insert_default_bhd_role_permission
	AFTER INSERT ON bhd_role
	FOR EACH ROW
	EXECUTE FUNCTION insert_default_bhd_role_permission();`

	mg.AddMigration("bhd: create trigger to insert default permission for newly created role", mig.NewRawSQLMigration(rawSQL))
}
