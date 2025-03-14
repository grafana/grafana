package accesscontrol

import (
	"fmt"
	"strings"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	datasourceDrilldownRemoval = "delete all drilldown actions, their assignments, and related roles"
)

func AddDatasourceDrilldownRemovalMigration(mg *migrator.Migrator) {
	mg.AddMigration(datasourceDrilldownRemoval, &datasourceDrilldownRemovalMigrator{})
}

type datasourceDrilldownRemovalMigrator struct {
	migrator.MigrationBase
}

func (m *datasourceDrilldownRemovalMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *datasourceDrilldownRemovalMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var roleIDs []int64
	err := sess.SQL("SELECT DISTINCT role_id FROM permission WHERE action LIKE ?", "%datasources:drilldown%").Find(&roleIDs)
	if err != nil {
		mg.Logger.Error("Failed to find roles with drilldown permissions", "error", err)
		// Continue with the migration even if we can't find roles
		// we still want to remove the permissions
	}

	if len(roleIDs) > 0 {
		mg.Logger.Info(fmt.Sprintf("Found %d roles with datasources:drilldown permissions", len(roleIDs)))

		inClause := "(" + strings.Repeat("?,", len(roleIDs)-1) + "?)"
		roleIDsInterface := make([]any, len(roleIDs))
		for i, id := range roleIDs {
			roleIDsInterface[i] = id
		}

		// Remove user role assignments for these roles
		userRoleSQL := "DELETE FROM user_role WHERE role_id IN " + inClause
		userRoleResult, err := sess.Exec(append([]any{userRoleSQL}, roleIDsInterface...)...)
		if err != nil {
			mg.Logger.Error("Failed to delete user role assignments for drilldown roles", "error", err)
		} else {
			userRoleRowsAffected, err := userRoleResult.RowsAffected()
			if err != nil {
				mg.Logger.Info("Removed user role assignments for drilldown roles, but couldn't determine how many")
			} else {
				mg.Logger.Info(fmt.Sprintf("Removed %d user role assignments for drilldown roles", userRoleRowsAffected))
			}
		}

		// Remove team role assignments for these roles
		teamRoleSQL := "DELETE FROM team_role WHERE role_id IN " + inClause
		teamRoleResult, err := sess.Exec(append([]any{teamRoleSQL}, roleIDsInterface...)...)
		if err != nil {
			mg.Logger.Error("Failed to delete team role assignments for drilldown roles", "error", err)
		} else {
			teamRoleRowsAffected, err := teamRoleResult.RowsAffected()
			if err != nil {
				mg.Logger.Info("Removed team role assignments for drilldown roles, but couldn't determine how many")
			} else {
				mg.Logger.Info(fmt.Sprintf("Removed %d team role assignments for drilldown roles", teamRoleRowsAffected))
			}
		}

		// Remove builtin role assignments for these roles
		builtinRoleSQL := "DELETE FROM builtin_role WHERE role_id IN " + inClause
		builtinRoleResult, err := sess.Exec(append([]any{builtinRoleSQL}, roleIDsInterface...)...)
		if err != nil {
			mg.Logger.Error("Failed to delete builtin role assignments for drilldown roles", "error", err)
		} else {
			builtinRoleRowsAffected, err := builtinRoleResult.RowsAffected()
			if err != nil {
				mg.Logger.Info("Removed builtin role assignments for drilldown roles, but couldn't determine how many")
			} else {
				mg.Logger.Info(fmt.Sprintf("Removed %d builtin role assignments for drilldown roles", builtinRoleRowsAffected))
			}
		}
	}

	// Remove all permissions with action containing 'drilldown'
	result, err := sess.Exec("DELETE FROM permission WHERE action LIKE ?", "%datasources:drilldown%")
	if err != nil {
		mg.Logger.Error("Failed to delete datasources:drilldown permissions", "error", err)
		// This is a critical step, but we'll continue with the migration
	} else {
		rowsAffected, err := result.RowsAffected()
		if err != nil {
			mg.Logger.Info("Removed datasources:drilldown permissions, but couldn't determine how many")
		} else {
			mg.Logger.Info(fmt.Sprintf("Removed %d datasources:drilldown permissions", rowsAffected))
		}
	}

	// Remove all seed assignments with action containing 'drilldown'
	seedResult, err := sess.Exec("DELETE FROM seed_assignment WHERE action LIKE ?", "%datasources:drilldown%")
	if err != nil {
		mg.Logger.Error("Failed to delete datasources:drilldown seed assignments", "error", err)
		// Continue with the migration
	} else {
		seedRowsAffected, err := seedResult.RowsAffected()
		if err != nil {
			mg.Logger.Info("Removed datasources:drilldown seed assignments, but couldn't determine how many")
		} else {
			mg.Logger.Info(fmt.Sprintf("Removed %d datasources:drilldown seed assignments", seedRowsAffected))
		}
	}

	return nil
}
