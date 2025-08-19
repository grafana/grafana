package accesscontrol

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const AddActionSetMigrationID = "adding action set permissions"

func AddActionSetPermissionsMigrator(mg *migrator.Migrator) {
	mg.AddMigration(AddActionSetMigrationID, &actionSetMigrator{})
}

type actionSetMigrator struct {
	sess     *xorm.Session
	migrator *migrator.Migrator
	migrator.MigrationBase
}

var _ migrator.CodeMigration = new(actionSetMigrator)

func (m *actionSetMigrator) SQL(migrator.Dialect) string {
	return "code migration"
}

func (m *actionSetMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	m.sess = sess
	m.migrator = migrator
	return m.addActionSetActions()
}

func (m *actionSetMigrator) addActionSetActions() error {
	var results []accesscontrol.Permission

	// Find action sets and dashboard permissions for managed roles
	// We don't need all dashboard permissions, just enough to help us determine what action set permissions to add
	sql := `
	SELECT permission.role_id, permission.action, permission.scope FROM permission
		LEFT JOIN role ON permission.role_id = role.id
		WHERE permission.action IN ('dashboards:read', 'dashboards:write', 'dashboards.permissions:read', 'dashboards:view', 'dashboards:edit', 'dashboards:admin', 'folders:view', 'folders:edit', 'folders:admin')
		AND role.name LIKE 'managed:%'
`
	if err := m.sess.SQL(sql).Find(&results); err != nil {
		return fmt.Errorf("failed to query permissions: %w", err)
	}

	// group permissions by map[roleID]map[scope]actionSet
	groupedPermissions := make(map[int64]map[string]string)
	hasActionSet := make(map[int64]map[string]bool)
	for _, result := range results {
		// keep track of which dash/folder permission grants already have an action set permission
		if isActionSetAction(result.Action) {
			if _, ok := hasActionSet[result.RoleID]; !ok {
				hasActionSet[result.RoleID] = make(map[string]bool)
			}
			hasActionSet[result.RoleID][result.Scope] = true
			delete(groupedPermissions[result.RoleID], result.Scope)
			continue
		}

		// don't add action set permissions where they already exist
		if _, has := hasActionSet[result.RoleID]; has && hasActionSet[result.RoleID][result.Scope] {
			continue
		}

		if _, ok := groupedPermissions[result.RoleID]; !ok {
			groupedPermissions[result.RoleID] = make(map[string]string)
		}

		// store the most permissive action set permission
		currentActionSet := groupedPermissions[result.RoleID][result.Scope]
		switch result.Action {
		case "dashboards:read":
			if currentActionSet == "" {
				groupedPermissions[result.RoleID][result.Scope] = "view"
			}
		case "dashboards:write":
			if currentActionSet != "admin" {
				groupedPermissions[result.RoleID][result.Scope] = "edit"
			}
		case "dashboards.permissions:read":
			groupedPermissions[result.RoleID][result.Scope] = "admin"
		}
	}

	toAdd := make([]accesscontrol.Permission, 0, len(groupedPermissions))

	now := time.Now()
	for roleID, permissions := range groupedPermissions {
		for scope, action := range permissions {
			// should never be the case, but keeping this check for extra safety
			if _, ok := hasActionSet[roleID][scope]; ok {
				continue
			}

			if strings.HasPrefix(scope, "folders:") {
				action = fmt.Sprintf("folders:%s", action)
			} else {
				action = fmt.Sprintf("dashboards:%s", action)
			}

			kind, attr, identifier := accesscontrol.SplitScope(scope)
			toAdd = append(toAdd, accesscontrol.Permission{
				RoleID:     roleID,
				Scope:      scope,
				Action:     action,
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
			m.migrator.Logger.Debug(fmt.Sprintf("inserting permissions %v", toAdd[start:end]))
			if _, err := m.sess.InsertMulti(toAdd[start:end]); err != nil {
				return fmt.Errorf("failed to add action sets: %w", err)
			}
			return nil
		})
		if err != nil {
			return err
		}
		m.migrator.Logger.Debug("updated managed roles with dash and folder action set permissions")
	}

	return nil
}

func isActionSetAction(action string) bool {
	return action == "dashboards:view" || action == "dashboards:edit" || action == "dashboards:admin" || action == "folders:view" || action == "folders:edit" || action == "folders:admin"
}
