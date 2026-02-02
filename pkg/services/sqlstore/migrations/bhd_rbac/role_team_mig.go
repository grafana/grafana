/*
 * Copyright (C) 2023-2025 BMC Helix Inc
 * Added by abjadhav at 10/16/2023
 */

package mig_rbac

import (
	mig "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func AddRoleTeamRbacTable(mg *mig.Migrator) {
	teamBHDRoleTableV1 := mig.Table{
		Name: "team_bhd_role",
		Columns: []*mig.Column{
			{Name: "team_id", Type: mig.DB_BigInt, IsPrimaryKey: true, Nullable: false},
			{Name: "bhd_role_id", Type: mig.DB_BigInt, IsPrimaryKey: true, Nullable: false},
			{Name: "org_id", Type: mig.DB_BigInt, IsPrimaryKey: true, Nullable: false},
		},
	}
	mg.AddMigration("bhd: create team_bhd_role table v1", mig.NewAddTableMigration(teamBHDRoleTableV1))

	rawSQL := `ALTER TABLE team_bhd_role ADD CONSTRAINT team_bhd_role_team_id_fkey FOREIGN KEY (team_id) REFERENCES team(id) ON DELETE CASCADE;`
	mg.AddMigration("bhd: alter table team_bhd_role to add team_id FOREIGN KEY constraints v1", mig.NewRawSQLMigration(rawSQL))

	rawSQL = `ALTER TABLE team_bhd_role ADD CONSTRAINT team_bhd_role_role_id_fkey FOREIGN KEY (bhd_role_id) REFERENCES bhd_role(bhd_role_id) ON DELETE CASCADE;`
	mg.AddMigration("bhd: alter table team_bhd_role to add bhd_role_id FOREIGN KEY constraints v1", mig.NewRawSQLMigration(rawSQL))

	rawSQL = `ALTER TABLE team_bhd_role ADD CONSTRAINT team_bhd_role_org_id_fkey FOREIGN KEY (org_id) REFERENCES org(id) ON DELETE CASCADE;`
	mg.AddMigration("bhd: alter table team_bhd_role to add org_id FOREIGN KEY constraints v1", mig.NewRawSQLMigration(rawSQL))
}
