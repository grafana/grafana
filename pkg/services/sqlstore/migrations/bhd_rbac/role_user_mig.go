/*
 * Copyright (C) 2023-2025 BMC Helix Inc
 * Added by abjadhav at 10/16/2023
 */

package mig_rbac

import (
	mig "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func AddRoleUserRbacTable(mg *mig.Migrator) {
	userBHDRoleTableV1 := mig.Table{
		Name: "user_bhd_role",
		Columns: []*mig.Column{
			{Name: "user_id", Type: mig.DB_BigInt, IsPrimaryKey: true, Nullable: false},
			{Name: "bhd_role_id", Type: mig.DB_BigInt, IsPrimaryKey: true, Nullable: false},
			{Name: "org_id", Type: mig.DB_BigInt, IsPrimaryKey: true, Nullable: false},
		},
	}
	mg.AddMigration("bhd: create user_bhd_role table v1", mig.NewAddTableMigration(userBHDRoleTableV1))

	rawSQL := `ALTER TABLE user_bhd_role ADD CONSTRAINT user_bhd_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;`
	mg.AddMigration("bhd: alter table user_bhd_role to add user_id FOREIGN KEY constraints", mig.NewRawSQLMigration(rawSQL))

	rawSQL = `ALTER TABLE user_bhd_role ADD CONSTRAINT user_bhd_role_role_id_fkey FOREIGN KEY (bhd_role_id) REFERENCES bhd_role(bhd_role_id) ON DELETE CASCADE;`
	mg.AddMigration("bhd: alter table user_bhd_role to add bhd_role_id FOREIGN KEY constraints", mig.NewRawSQLMigration(rawSQL))

	rawSQL = `ALTER TABLE user_bhd_role ADD CONSTRAINT user_bhd_role_org_id_fkey FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE;`
	mg.AddMigration("bhd: alter table user_bhd_role to add org_id FOREIGN KEY constraints", mig.NewRawSQLMigration(rawSQL))
}
