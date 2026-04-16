package accesscontrol

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const AddSAActionSetMigrationID = "adding service account action set permissions"

func AddSAActionSetPermissionsMigrator(mg *migrator.Migrator) {
	mg.AddMigration(AddSAActionSetMigrationID, &saActionSetMigrator{})
}

type saActionSetMigrator struct {
	sess     *xorm.Session
	migrator *migrator.Migrator
	migrator.MigrationBase
}

var _ migrator.CodeMigration = new(saActionSetMigrator)

func (m *saActionSetMigrator) SQL(migrator.Dialect) string {
	return "code migration"
}

func (m *saActionSetMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	m.sess = sess
	m.migrator = mg
	return m.addSAActionSetActions()
}

func (m *saActionSetMigrator) addSAActionSetActions() error {
	var results []accesscontrol.Permission

	// Fetch SA granular actions and any existing action set tokens for managed roles.
	// serviceaccounts:delete is the key differentiator: its presence signals Admin level.
	sql := `
	SELECT permission.role_id, permission.action, permission.scope FROM permission
		LEFT JOIN role ON permission.role_id = role.id
		WHERE permission.action IN ('serviceaccounts:write', 'serviceaccounts:delete', 'serviceaccounts:edit', 'serviceaccounts:admin')
		AND permission.scope LIKE 'serviceaccounts:id:%'
		AND role.name LIKE 'managed:%'
`
	if err := m.sess.SQL(sql).Find(&results); err != nil {
		return fmt.Errorf("failed to query service account permissions: %w", err)
	}

	// groupedPermissions tracks the highest action set level per (roleID, scope).
	// hasActionSet tracks pairs that already have a token, so we skip them.
	groupedPermissions := make(map[int64]map[string]string) // map[roleID][scope] = "edit"|"admin"
	hasActionSet := make(map[int64]map[string]bool)         // map[roleID][scope] = true

	for _, result := range results {
		if isSAActionSetToken(result.Action) {
			if _, ok := hasActionSet[result.RoleID]; !ok {
				hasActionSet[result.RoleID] = make(map[string]bool)
			}
			hasActionSet[result.RoleID][result.Scope] = true
			// Remove from groupedPermissions if we already queued it — no need to insert.
			delete(groupedPermissions[result.RoleID], result.Scope)
			continue
		}

		// Skip if we already know this pair has a token.
		if hasActionSet[result.RoleID][result.Scope] {
			continue
		}

		if _, ok := groupedPermissions[result.RoleID]; !ok {
			groupedPermissions[result.RoleID] = make(map[string]string)
		}

		// Promote to the highest level seen for this (roleID, scope).
		// Admin is signalled by serviceaccounts:delete; edit by serviceaccounts:write.
		current := groupedPermissions[result.RoleID][result.Scope]
		switch result.Action {
		case "serviceaccounts:delete":
			groupedPermissions[result.RoleID][result.Scope] = "admin"
		case "serviceaccounts:write":
			if current != "admin" {
				groupedPermissions[result.RoleID][result.Scope] = "edit"
			}
		}
	}

	toAdd := make([]accesscontrol.Permission, 0, len(groupedPermissions))
	now := time.Now()

	for roleID, permissions := range groupedPermissions {
		for scope, level := range permissions {
			kind, attr, identifier := accesscontrol.SplitScope(scope)
			toAdd = append(toAdd, accesscontrol.Permission{
				RoleID:     roleID,
				Scope:      scope,
				Action:     "serviceaccounts:" + level,
				Kind:       kind,
				Attribute:  attr,
				Identifier: identifier,
				Created:    now,
				Updated:    now,
			})
		}
	}

	if len(toAdd) > 0 {
		err := batch(len(toAdd), batchSize, func(start, end int) error {
			m.migrator.Logger.Debug(fmt.Sprintf("inserting service account action set permissions %v", toAdd[start:end]))
			if _, err := m.sess.InsertMulti(toAdd[start:end]); err != nil {
				return fmt.Errorf("failed to insert service account action set permissions: %w", err)
			}
			return nil
		})
		if err != nil {
			return err
		}
		m.migrator.Logger.Debug("updated managed roles with service account action set permissions")
	}

	return nil
}

func isSAActionSetToken(action string) bool {
	return action == "serviceaccounts:edit" || action == "serviceaccounts:admin"
}
