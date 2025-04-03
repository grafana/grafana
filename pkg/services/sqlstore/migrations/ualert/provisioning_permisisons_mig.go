package ualert

import (
	"fmt"
	"maps"
	"slices"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func ProvisioningPermissionsMigration(mg *migrator.Migrator) {
	mg.AddMigration("delete alert.provisioning permissions", &removeProvisioningPermissions{})
}

type removeProvisioningPermissions struct {
	migrator.MigrationBase
}

func (p removeProvisioningPermissions) SQL(migrator.Dialect) string {
	return codeMigration
}

func (p removeProvisioningPermissions) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	permissionsToAdd := make(map[role][]string)
	// Add permissions to provision rules and notifications
	err := p.getRolesToUpdate(sess, "alert.provisioning:read", "alert.rules.provisioning:read", permissionsToAdd)
	if err != nil {
		return fmt.Errorf("failed to get roles to update: %w", err)
	}
	err = p.getRolesToUpdate(sess, "alert.provisioning:read", "alert.notifications.provisioning:read", permissionsToAdd)
	if err != nil {
		return fmt.Errorf("failed to get roles to update: %w", err)
	}
	err = p.getRolesToUpdate(sess, "alert.provisioning:write", "alert.rules.provisioning:write", permissionsToAdd)
	if err != nil {
		return fmt.Errorf("failed to get roles to update: %w", err)
	}
	err = p.getRolesToUpdate(sess, "alert.provisioning:write", "alert.notifications.provisioning:write", permissionsToAdd)
	if err != nil {
		return fmt.Errorf("failed to get roles to update: %w", err)
	}
	// now we got roles and permissions that needs to be added.
	permissions := make([]accesscontrol.Permission, 0)
	for role, actions := range permissionsToAdd {
		uniqueActions := make(map[string]struct{}, len(actions))
		for _, action := range actions {
			uniqueActions[action] = struct{}{}
		}
		actions = slices.Collect(maps.Keys(uniqueActions))
		migrator.Logger.Info("Adding permissions to role", "role", role.Name, "actions", actions)
		for _, action := range actions {
			permissions = append(permissions, accesscontrol.Permission{
				RoleID:  role.RoleID,
				Action:  action,
				Created: time.Now(),
				Updated: time.Now(),
			})
		}
	}
	if len(permissions) > 0 {
		_, err = sess.Insert(&permissions)
		if err != nil {
			return fmt.Errorf("failed to add permissions: %w", err)
		}
	} else {
		migrator.Logger.Debug("No roles to add permissions to")
	}
	_, err = sess.Exec("DELETE FROM permission WHERE action = 'alert.provisioning:read' OR action = 'alert.provisioning:write'")
	if err != nil {
		return fmt.Errorf("failed to delete old permissions: %w", err)
	}
	return nil
}

type role struct {
	RoleID int64 `xorm:"role_id"`
	Name   string
}

func (p removeProvisioningPermissions) getRolesToUpdate(sess *xorm.Session, existingAction, notExistingAction string, add map[role][]string) error {
	var result []role
	err := sess.SQL(`
		SELECT DISTINCT P1.role_id, R.name
		FROM permission AS P1
			INNER JOIN role AS R ON R.id = P1.role_id
		WHERE EXISTS (SELECT 1 FROM permission AS P2 WHERE action = ? AND P1.role_id = P2.role_id)
		    AND NOT EXISTS (SELECT 1 FROM permission AS P3 WHERE action = ? AND P1.role_id = P3.role_id)`, existingAction, notExistingAction).Find(&result)

	for _, r := range result {
		add[r] = append(add[r], notExistingAction)
	}
	return err
}
