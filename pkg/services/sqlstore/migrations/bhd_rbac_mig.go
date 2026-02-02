/*
 * Copyright (C) 2023-2025 BMC Helix Inc
 * Added by abjadhav at 10/16/2023
 */

package migrations

import (
	rbac "github.com/grafana/grafana/pkg/services/sqlstore/migrations/bhd_rbac"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// AddRbacTables is a custom migration for adding the bhd_rbac tables
func addRbacTables(mg *migrator.Migrator) {
	rbac.AddRoleRbacTable(mg)
	rbac.AddRoleTeamRbacTable(mg)
	rbac.AddRoleUserRbacTable(mg)
	rbac.AddPermissionRbacTable(mg)
	rbac.AddRolePermissionRbacTable(mg)
	rbac.CreateRoleRbacTrigger(mg)
}
