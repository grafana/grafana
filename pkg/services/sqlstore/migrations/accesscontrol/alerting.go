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

type permission struct {
	Id      int64
	RoleId  int64
	Action  string
	Scope   string
	Created time.Time
	Updated time.Time
}

func (m *alertingMigrator) migrateNotificationActions() error {
	var results []permission
	err := m.sess.Table(&permission{}).In("action", "alert.notifications:update", "alert.notifications:create", "alert.notifications:delete", accesscontrol.ActionAlertingNotificationsWrite).Find(&results)
	if err != nil {
		return fmt.Errorf("failed to query permission table: %w", err)
	}
	groupByRoleID := make(map[int64]bool)
	toDelete := make([]interface{}, 0, len(results))
	for _, result := range results {
		if result.Action == accesscontrol.ActionAlertingNotificationsWrite {
			groupByRoleID[result.RoleId] = false
			continue // do not delete this permission
		}
		if _, ok := groupByRoleID[result.RoleId]; !ok {
			groupByRoleID[result.RoleId] = true
		}
		toDelete = append(toDelete, result.Id)
	}

	toAdd := make([]permission, 0, len(groupByRoleID))

	now := time.Now()
	for roleID, add := range groupByRoleID {
		if !add {
			m.migrator.Logger.Info(fmt.Sprintf("skip adding action %s to role ID %d because it is already there", accesscontrol.ActionAlertingNotificationsWrite, roleID))
			continue
		}
		toAdd = append(toAdd, permission{
			RoleId:  roleID,
			Action:  accesscontrol.ActionAlertingNotificationsWrite,
			Scope:   "",
			Created: now,
			Updated: now,
		})
	}

	added, err := m.sess.InsertMulti(toAdd)
	if err != nil {
		return fmt.Errorf("failed to insert new permissions:%w", err)
	}
	m.migrator.Logger.Debug(fmt.Sprintf("updated %d of %d roles with new permission %s", added, len(toAdd), accesscontrol.ActionAlertingNotificationsWrite))

	_, err = m.sess.Table(permission{}).In("id", toDelete...).Delete(permission{})
	if err != nil {
		m.migrator.Logger.Warn("failed to delete deprecated permissions [alert.notifications:update, alert.notifications:create, alert.notifications:delete]", "err", err)
	}

	return nil
}
