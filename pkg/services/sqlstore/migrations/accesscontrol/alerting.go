package accesscontrol

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util/xorm"

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

type receiverCreateScopeMigration struct {
	migrator.MigrationBase
}

var _ migrator.CodeMigration = new(alertingMigrator)

func (m *receiverCreateScopeMigration) SQL(migrator.Dialect) string {
	return "code migration"
}

func (m *receiverCreateScopeMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	result, err := sess.Exec(`UPDATE permission
		SET scope = '',
		    kind = '',
		    attribute='',
		    identifier=''
		WHERE action = 'alert.notifications.receivers:create'
		    AND (scope <> '' OR kind <> '' OR attribute <> '' OR identifier <> '');`)
	if result != nil {
		aff, _ := result.RowsAffected()
		if aff > 0 {
			mg.Logger.Info("Removed scope from permission 'alert.notifications.receivers:create'", "affectedRows", aff)
		}
	}
	return err
}

func AddReceiverCreateScopeMigration(mg *migrator.Migrator) {
	mg.AddMigration("remove scope from alert.notifications.receivers:create", &receiverCreateScopeMigration{})
}

type receiverProtectedFieldsEditor struct {
	migrator.MigrationBase
}

var _ migrator.CodeMigration = new(alertingMigrator)

func (m *receiverProtectedFieldsEditor) SQL(migrator.Dialect) string {
	return "code migration"
}

func (m *receiverProtectedFieldsEditor) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	sql := `SELECT *
			FROM permission AS P
			WHERE action = 'alert.notifications.receivers.secrets:read'
			    AND EXISTS(SELECT 1 FROM role AS R WHERE R.id = P.role_id AND R.name LIKE 'managed:%')
			    AND NOT EXISTS(SELECT 1
			                   FROM permission AS P2
			                   WHERE P2.role_id = P.role_id
			                     AND P2.action = 'alert.notifications.receivers.protected:write' AND P2.scope = P.scope
			                   )`
	var results []accesscontrol.Permission
	if err := sess.SQL(sql).Find(&results); err != nil {
		return fmt.Errorf("failed to query permissions: %w", err)
	}

	permissionsToCreate := make([]accesscontrol.Permission, 0, len(results))
	rolesAffected := make(map[int64][]string, 0)
	for _, result := range results {
		result.ID = 0
		result.Action = "alert.notifications.receivers.protected:write"
		result.Created = time.Now()
		result.Updated = time.Now()
		permissionsToCreate = append(permissionsToCreate, result)
		rolesAffected[result.RoleID] = append(rolesAffected[result.RoleID], result.Identifier)
	}
	_, err := sess.InsertMulti(&permissionsToCreate)
	for id, ids := range rolesAffected {
		mg.Logger.Debug("Added permission 'alert.notifications.receivers.protected:write' to managed role", "roleID", id, "identifiers", ids)
	}
	return err
}

func AddReceiverProtectedFieldsEditor(mg *migrator.Migrator) {
	mg.AddMigration("add 'alert.notifications.receivers.protected:write' to receiver admins", &receiverProtectedFieldsEditor{})
}

type scopedReceiverTestingPermissions struct {
	migrator.MigrationBase
}

var _ migrator.CodeMigration = new(alertingMigrator)

func (m *scopedReceiverTestingPermissions) SQL(migrator.Dialect) string {
	return "code migration"
}

func (m *scopedReceiverTestingPermissions) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	sql := fmt.Sprintf(`SELECT *
			FROM permission AS P
			WHERE action = '%[1]s'
			    AND EXISTS(SELECT 1 FROM role AS R WHERE R.id = P.role_id AND R.name LIKE 'managed:%%')
			    AND NOT EXISTS(SELECT 1
			                   FROM permission AS P2
			                   WHERE P2.role_id = P.role_id
			                     AND P2.action = '%[2]s' AND P2.scope = P.scope
			                   )`, accesscontrol.ActionAlertingReceiversUpdate, accesscontrol.ActionAlertingReceiversTestCreate)
	var results []accesscontrol.Permission
	if err := sess.SQL(sql).Find(&results); err != nil {
		return fmt.Errorf("failed to query permissions: %w", err)
	}

	permissionsToCreate := make([]accesscontrol.Permission, 0, len(results))
	rolesAffected := make(map[int64][]string)
	for _, result := range results {
		result.ID = 0
		result.Action = accesscontrol.ActionAlertingReceiversTestCreate
		result.Created = time.Now()
		result.Updated = time.Now()
		permissionsToCreate = append(permissionsToCreate, result)
		rolesAffected[result.RoleID] = append(rolesAffected[result.RoleID], result.Identifier)
	}
	_, err := sess.InsertMulti(&permissionsToCreate)
	if err == nil {
		for id, ids := range rolesAffected {
			mg.Logger.Debug(fmt.Sprintf("Added permission '%s' to managed role", accesscontrol.ActionAlertingReceiversTestCreate), "roleID", id, "identifiers", ids)
		}
	}
	return err
}

func AddScopedReceiverTestingPermissions(mg *migrator.Migrator) {
	mg.AddMigration("add 'alert.notifications.receivers.test:create' to managed roles", &scopedReceiverTestingPermissions{})
}

type managedRoutesPermissions struct {
	migrator.MigrationBase
}

var _ migrator.CodeMigration = new(managedRoutesPermissions)

func (m *managedRoutesPermissions) SQL(migrator.Dialect) string {
	return "code migration"
}

func (m *managedRoutesPermissions) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	// Grant default route permissions to basic roles (Editor=Edit, Viewer=View).
	// This mirrors routeDefaultPermissions() in ossaccesscontrol/routes.go.
	// Only adds permissions to existing managed roles — does not create new ones.

	scope := models.ScopeRoutesProvider.GetResourceScopeUID(models.DefaultRoutingTreeName)
	viewerActions := []string{
		accesscontrol.ActionAlertingManagedRoutesRead,
	}
	editorActions := []string{
		accesscontrol.ActionAlertingManagedRoutesRead,
		accesscontrol.ActionAlertingManagedRoutesWrite,
		accesscontrol.ActionAlertingManagedRoutesDelete,
	}
	allActions := editorActions
	editorRoleName := accesscontrol.ManagedBuiltInRoleName(string(org.RoleEditor))
	viewerRoleName := accesscontrol.ManagedBuiltInRoleName(string(org.RoleViewer))

	// Single query: fetch all editor and viewer managed roles across all orgs.
	var roles []accesscontrol.Role
	if err := sess.In("name", editorRoleName, viewerRoleName).Find(&roles); err != nil {
		return fmt.Errorf("failed to find managed roles: %w", err)
	}
	if len(roles) == 0 {
		mg.Logger.Info("No managed roles found for editor/viewer, skipping default notification policy permissions")
		return nil
	}

	roleIDs := make([]int64, 0, len(roles))
	for _, r := range roles {
		roleIDs = append(roleIDs, r.ID)
	}

	// fetch all existing route permissions for these roles.
	var existing []accesscontrol.Permission
	if err := sess.Table("permission").In("role_id", roleIDs).In("action", allActions).Where("scope = ?", scope).Find(&existing); err != nil {
		return fmt.Errorf("failed to check existing permissions: %w", err)
	}

	type roleAction struct {
		roleID int64
		action string
	}
	existingSet := make(map[roleAction]bool, len(existing))
	for _, p := range existing {
		existingSet[roleAction{roleID: p.RoleID, action: p.Action}] = true
	}

	// Build the list of permissions to insert.
	now := time.Now()
	var toInsert []accesscontrol.Permission
	for _, role := range roles {
		actions := editorActions
		if role.Name == viewerRoleName {
			actions = viewerActions
		}
		for _, action := range actions {
			if existingSet[roleAction{roleID: role.ID, action: action}] {
				continue
			}
			p := accesscontrol.Permission{
				RoleID:  role.ID,
				Action:  action,
				Scope:   scope,
				Updated: now,
				Created: now,
			}
			p.Kind, p.Attribute, p.Identifier = p.SplitScope()
			toInsert = append(toInsert, p)
		}
	}

	if len(toInsert) > 0 {
		if _, err := sess.InsertMulti(&toInsert); err != nil {
			return fmt.Errorf("failed to insert permissions: %w", err)
		}
	}
	return nil
}

func AddManagedRoutesPermissions(mg *migrator.Migrator) {
	mg.AddMigration("grant basic roles access to default notification policy", &managedRoutesPermissions{})
}
