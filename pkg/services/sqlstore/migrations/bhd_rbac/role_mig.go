/*
 * Copyright (C) 2023-2025 BMC Helix Inc
 * Added by abjadhav at 10/16/2023
 */

package mig_rbac

import (
	mig "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func AddRoleRbacTable(mg *mig.Migrator) {
	roleTableV1 := mig.Table{
		Name: "bhd_role",
		Columns: []*mig.Column{
			{Name: "bhd_role_id", Type: mig.DB_BigInt, IsPrimaryKey: true, Nullable: false, IsAutoIncrement: true},
			{Name: "name", Type: mig.DB_Text, Nullable: false},
			{Name: "description", Type: mig.DB_Text, Nullable: true},
			{Name: "org_id", Type: mig.DB_BigInt, Nullable: false},
			{Name: "system_role", Type: mig.DB_Bool, Nullable: false, Default: "false"},
			{Name: "created_time", Type: mig.DB_DateTime, Nullable: true},
			{Name: "updated_time", Type: mig.DB_DateTime, Nullable: true},
			{Name: "created_by", Type: mig.DB_Text, Nullable: true, Default: "'system'"},
			{Name: "updated_by", Type: mig.DB_Text, Nullable: true, Default: "'system'"},
			{Name: "tags", Type: mig.DB_Text, Nullable: true},
		},
		Indices: []*mig.Index{
			{
				Name: "bhd_role_name_org_id_ukey",
				Type: mig.UniqueIndex,
				Cols: []string{"name", "org_id"},
			},
		},
	}
	mg.AddMigration("bhd: create bhd_role table v1", mig.NewAddTableMigration(roleTableV1))
	mg.AddMigration("bhd: alter table create index bhd_role_name_org_id_ukey", mig.NewAddIndexMigration(roleTableV1, roleTableV1.Indices[0]))
	mg.AddMigration("bhd: alter table bhd_role sequence ", mig.NewRawSQLMigration(`ALTER SEQUENCE bhd_role_bhd_role_id_seq RESTART 101`))
	mg.AddMigration("bhd: add system Admin role", mig.NewRawSQLMigration(`
		INSERT INTO bhd_role (bhd_role_id, name, description, org_id, system_role, created_time, updated_time)
	  	VALUES(1, 'Admin', 'All permissions for Dashboard.',1, true, 'NOW()', 'NOW()')`))

	mg.AddMigration("bhd: add system Editor role", mig.NewRawSQLMigration(`
		INSERT INTO bhd_role (bhd_role_id, name, description, org_id, system_role, created_time, updated_time)
		VALUES(2, 'Editor', 'All editing permissions for Dashboard.',1, true, 'NOW()', 'NOW()')`))

	mg.AddMigration("bhd: add system Viewer role", mig.NewRawSQLMigration(`
		INSERT INTO bhd_role (bhd_role_id, name, description, org_id, system_role, created_time, updated_time)
		VALUES(3, 'Viewer', 'View only permissions for Dashboard.',1, true, 'NOW()', 'NOW()')`))
}
