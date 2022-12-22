package accesscontrol

import (
	"fmt"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func AddAlertingPermissionsMigrator(mg *migrator.Migrator) {
	mg.AddMigration("alerting notification permissions", &alertingMigrator{})
}

type alertingMigrator struct {
	sess     *xorm.Session
	migrator *migrator.Migrator
	migrator.MigrationBase
}

var _ migrator.CodeMigration = new(alertingMigrator)

func (m *alertingMigrator) SQL(migrator.Dialect) string {
	return "code migration"
}

func (m *alertingMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	m.sess = sess
	m.migrator = migrator
	return m.migrateNotificationActions()
}

func (m *alertingMigrator) migrateNotificationActions() error {
	var results []accesscontrol.Permission
	err := m.sess.Table(&accesscontrol.Permission{}).In("action", "alert.notifications:update", "alert.notifications:create", "alert.notifications:delete", accesscontrol.ActionAlertingNotificationsWrite).Find(&results)
	if err != nil {
		return fmt.Errorf("failed to query permission table: %w", err)
	}
	groupByRoleID := make(map[int64]bool)
	toDelete := make([]interface{}, 0, len(results))
	for _, result := range results {
		if result.Action == accesscontrol.ActionAlertingNotificationsWrite {
			groupByRoleID[result.RoleID] = false
			continue // do not delete this permission
		}
		if _, ok := groupByRoleID[result.RoleID]; !ok {
			groupByRoleID[result.RoleID] = true
		}
		toDelete = append(toDelete, result.ID)
	}

	toAdd := make([]accesscontrol.Permission, 0, len(groupByRoleID))

	now := time.Now()
	for roleID, add := range groupByRoleID {
		if !add {
			m.migrator.Logger.Info(fmt.Sprintf("skip adding action %s to role ID %d because it is already there", accesscontrol.ActionAlertingNotificationsWrite, roleID))
			continue
		}
		toAdd = append(toAdd, accesscontrol.Permission{
			RoleID:  roleID,
			Action:  accesscontrol.ActionAlertingNotificationsWrite,
			Scope:   "",
			Created: now,
			Updated: now,
		})
	}

	if len(toAdd) > 0 {
		added, err := m.sess.Table(&accesscontrol.Permission{}).InsertMulti(toAdd)
		if err != nil {
			return fmt.Errorf("failed to insert new permissions:%w", err)
		}
		m.migrator.Logger.Debug(fmt.Sprintf("updated %d of %d roles with new permission %s", added, len(toAdd), accesscontrol.ActionAlertingNotificationsWrite))
	}

	if len(toDelete) > 0 {
		_, err = m.sess.Table(&accesscontrol.Permission{}).In("id", toDelete...).Delete(accesscontrol.Permission{})
		if err != nil {
			return fmt.Errorf("failed to delete deprecated permissions [alert.notifications:update, alert.notifications:create, alert.notifications:delete]:%w", err)
		}
	}

	return nil
}
