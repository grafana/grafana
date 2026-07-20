package accesscontrol

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const AddDatasourceActionSetMigrationID = "adding datasource action set permissions"

func AddDatasourceActionSetPermissionsMigrator(mg *migrator.Migrator) {
	mg.AddMigration(AddDatasourceActionSetMigrationID, &datasourceActionSetMigrator{})
}

type datasourceActionSetMigrator struct {
	sess     *xorm.Session
	migrator *migrator.Migrator
	migrator.MigrationBase
}

var _ migrator.CodeMigration = new(datasourceActionSetMigrator)

func (m *datasourceActionSetMigrator) SQL(migrator.Dialect) string {
	return "code migration"
}

func (m *datasourceActionSetMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	m.sess = sess
	m.migrator = mg
	return m.addDatasourceActionSetActions()
}

func (m *datasourceActionSetMigrator) addDatasourceActionSetActions() error {
	var results []accesscontrol.Permission

	// Fetch DS granular edit/admin signals and any existing action set tokens for managed roles.
	// Managed grants are atomic: Edit always includes write (+ delete), Admin always includes
	// permissions:write (+ permissions:read). So write / permissions:write are sufficient signals.
	// datasources:query is both the Query granular action and the Query token — no Query backfill.
	sql := `
	SELECT permission.role_id, permission.action, permission.scope FROM permission
		INNER JOIN role ON permission.role_id = role.id
		WHERE permission.action IN (
			'datasources:write', 'datasources.permissions:write',
			'datasources:edit', 'datasources:admin'
		)
		AND permission.scope LIKE 'datasources:uid:%'
		AND role.name LIKE 'managed:%'
`
	if err := m.sess.SQL(sql).Find(&results); err != nil {
		return fmt.Errorf("failed to query datasource permissions: %w", err)
	}

	// groupedPermissions tracks the highest action set level per (roleID, scope).
	// hasActionSet tracks pairs that already have a token, so we skip them.
	groupedPermissions := make(map[int64]map[string]string) // map[roleID][scope] = "edit"|"admin"
	hasActionSet := make(map[int64]map[string]bool)         // map[roleID][scope] = true

	for _, result := range results {
		if isDatasourceActionSetToken(result.Action) {
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
		current := groupedPermissions[result.RoleID][result.Scope]
		switch result.Action {
		case "datasources.permissions:write":
			groupedPermissions[result.RoleID][result.Scope] = "admin"
		case "datasources:write":
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
				Action:     "datasources:" + level,
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
			m.migrator.Logger.Debug(fmt.Sprintf("inserting datasource action set permissions %v", toAdd[start:end]))
			if _, err := m.sess.InsertMulti(toAdd[start:end]); err != nil {
				return fmt.Errorf("failed to insert datasource action set permissions: %w", err)
			}
			return nil
		})
		if err != nil {
			return err
		}
		m.migrator.Logger.Debug("updated managed roles with datasource action set permissions")
	}

	return nil
}

func isDatasourceActionSetToken(action string) bool {
	return action == "datasources:edit" || action == "datasources:admin"
}
