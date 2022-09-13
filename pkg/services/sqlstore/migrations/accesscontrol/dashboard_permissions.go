package accesscontrol

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

var dashboardPermissionTranslation = map[models.PermissionType][]string{
	models.PERMISSION_VIEW: {
		dashboards.ActionDashboardsRead,
	},
	models.PERMISSION_EDIT: {
		dashboards.ActionDashboardsRead,
		dashboards.ActionDashboardsWrite,
		dashboards.ActionDashboardsDelete,
	},
	models.PERMISSION_ADMIN: {
		dashboards.ActionDashboardsRead,
		dashboards.ActionDashboardsWrite,
		dashboards.ActionDashboardsCreate,
		dashboards.ActionDashboardsDelete,
		dashboards.ActionDashboardsPermissionsRead,
		dashboards.ActionDashboardsPermissionsWrite,
	},
}

var folderPermissionTranslation = map[models.PermissionType][]string{
	models.PERMISSION_VIEW: append(dashboardPermissionTranslation[models.PERMISSION_VIEW], []string{
		dashboards.ActionFoldersRead,
	}...),
	models.PERMISSION_EDIT: append(dashboardPermissionTranslation[models.PERMISSION_EDIT], []string{
		dashboards.ActionDashboardsCreate,
		dashboards.ActionFoldersRead,
		dashboards.ActionFoldersWrite,
		dashboards.ActionFoldersDelete,
	}...),
	models.PERMISSION_ADMIN: append(dashboardPermissionTranslation[models.PERMISSION_ADMIN], []string{
		dashboards.ActionFoldersRead,
		dashboards.ActionFoldersWrite,
		dashboards.ActionFoldersDelete,
		dashboards.ActionFoldersPermissionsRead,
		dashboards.ActionFoldersPermissionsWrite,
	}...),
}

func AddDashboardPermissionsMigrator(mg *migrator.Migrator) {
	mg.AddMigration("dashboard permissions", &dashboardPermissionsMigrator{})
	mg.AddMigration("dashboard permissions uid scopes", &dashboardUidPermissionMigrator{})
	mg.AddMigration("drop managed folder create actions", &managedFolderCreateAction{})
}

var _ migrator.CodeMigration = new(dashboardPermissionsMigrator)

type dashboardPermissionsMigrator struct {
	permissionMigrator
}

type dashboard struct {
	ID       int64 `xorm:"id"`
	FolderID int64 `xorm:"folder_id"`
	OrgID    int64 `xorm:"org_id"`
	IsFolder bool
}

func (m dashboardPermissionsMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	m.sess = sess
	m.dialect = migrator.Dialect

	var dashboards []dashboard
	if err := m.sess.SQL("SELECT id, is_folder, folder_id, org_id FROM dashboard").Find(&dashboards); err != nil {
		return fmt.Errorf("failed to list dashboards: %w", err)
	}

	var acl []models.DashboardACL
	if err := m.sess.Find(&acl); err != nil {
		return fmt.Errorf("failed to list dashboard ACL: %w", err)
	}

	aclMap := make(map[int64][]models.DashboardACL, len(acl))
	for _, p := range acl {
		aclMap[p.DashboardID] = append(aclMap[p.DashboardID], p)
	}

	if err := m.migratePermissions(dashboards, aclMap, migrator); err != nil {
		return fmt.Errorf("failed to migrate permissions: %w", err)
	}

	return nil
}

func (m dashboardPermissionsMigrator) migratePermissions(dashboards []dashboard, aclMap map[int64][]models.DashboardACL, migrator *migrator.Migrator) error {
	permissionMap := map[int64]map[string][]*ac.Permission{}
	for _, d := range dashboards {
		if d.ID == -1 {
			continue
		}
		acls := aclMap[d.ID]
		if permissionMap[d.OrgID] == nil {
			permissionMap[d.OrgID] = map[string][]*ac.Permission{}
		}

		if (d.IsFolder || d.FolderID == 0) && len(acls) == 0 {
			permissionMap[d.OrgID]["managed:builtins:editor:permissions"] = append(
				permissionMap[d.OrgID]["managed:builtins:editor:permissions"],
				m.mapPermission(d.ID, models.PERMISSION_EDIT, d.IsFolder)...,
			)
			permissionMap[d.OrgID]["managed:builtins:viewer:permissions"] = append(
				permissionMap[d.OrgID]["managed:builtins:viewer:permissions"],
				m.mapPermission(d.ID, models.PERMISSION_VIEW, d.IsFolder)...,
			)
		} else {
			for _, a := range acls {
				permissionMap[d.OrgID][getRoleName(a)] = append(
					permissionMap[d.OrgID][getRoleName(a)],
					m.mapPermission(d.ID, a.Permission, d.IsFolder)...,
				)
			}
		}
	}

	var allRoles []*ac.Role
	rolesToCreate := []*ac.Role{}
	for orgID, roles := range permissionMap {
		for name := range roles {
			role, err := m.findRole(orgID, name)
			if err != nil {
				return fmt.Errorf("failed to find role %s: %w", name, err)
			}
			if role.ID == 0 {
				rolesToCreate = append(rolesToCreate, &ac.Role{OrgID: orgID, Name: name})
			} else {
				allRoles = append(allRoles, &role)
			}
		}
	}

	migrator.Logger.Debug(fmt.Sprintf("bulk-creating roles %v", rolesToCreate))
	createdRoles, err := m.bulkCreateRoles(rolesToCreate)
	if err != nil {
		return fmt.Errorf("failed to bulk-create roles: %w", err)
	}

	for i := range createdRoles {
		allRoles = append(allRoles, createdRoles[i])
	}

	if err := m.bulkAssignRoles(createdRoles); err != nil {
		return fmt.Errorf("failed to bulk-assign roles: %w", err)
	}

	return m.setPermissions(allRoles, permissionMap, migrator)
}

func (m dashboardPermissionsMigrator) setPermissions(allRoles []*ac.Role, permissionMap map[int64]map[string][]*ac.Permission, migrator *migrator.Migrator) error {
	now := time.Now()
	for _, role := range allRoles {
		migrator.Logger.Debug(fmt.Sprintf("setting permissions for role %s with ID %d in org %d", role.Name, role.ID, role.OrgID))
		if _, err := m.sess.Exec("DELETE FROM permission WHERE role_id = ? AND (action LIKE ? OR action LIKE ?)", role.ID, "dashboards%", "folders%"); err != nil {
			return fmt.Errorf("failed to clear dashboard and folder permissions for role: %w", err)
		}
		var permissions []ac.Permission
		mappedPermissions := permissionMap[role.OrgID][role.Name]
		for _, p := range mappedPermissions {
			permissions = append(permissions, ac.Permission{
				RoleID:  role.ID,
				Action:  p.Action,
				Scope:   p.Scope,
				Updated: now,
				Created: now,
			})
		}

		err := batch(len(permissions), batchSize, func(start, end int) error {
			migrator.Logger.Debug(fmt.Sprintf("inserting permissions %v", permissions[start:end]))
			if _, err := m.sess.InsertMulti(permissions[start:end]); err != nil {
				return fmt.Errorf("failed to create permissions for role: %w", err)
			}
			return nil
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (m dashboardPermissionsMigrator) mapPermission(id int64, p models.PermissionType, isFolder bool) []*ac.Permission {
	if isFolder {
		actions := folderPermissionTranslation[p]
		scope := dashboards.ScopeFoldersProvider.GetResourceScope(strconv.FormatInt(id, 10))
		permissions := make([]*ac.Permission, 0, len(actions))
		for _, action := range actions {
			permissions = append(permissions, &ac.Permission{Action: action, Scope: scope})
		}
		return permissions
	}

	actions := dashboardPermissionTranslation[p]
	scope := ac.Scope("dashboards", "id", strconv.FormatInt(id, 10))
	permissions := make([]*ac.Permission, 0, len(actions))
	for _, action := range actions {
		permissions = append(permissions, &ac.Permission{Action: action, Scope: scope})
	}
	return permissions
}

func getRoleName(p models.DashboardACL) string {
	if p.UserID != 0 {
		return fmt.Sprintf("managed:users:%d:permissions", p.UserID)
	}
	if p.TeamID != 0 {
		return fmt.Sprintf("managed:teams:%d:permissions", p.TeamID)
	}
	return fmt.Sprintf("managed:builtins:%s:permissions", strings.ToLower(string(*p.Role)))
}

var _ migrator.CodeMigration = new(dashboardUidPermissionMigrator)

type dashboardUidPermissionMigrator struct {
	migrator.MigrationBase
}

func (d *dashboardUidPermissionMigrator) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (d *dashboardUidPermissionMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	if err := d.migrateWildcards(sess); err != nil {
		return err
	}
	return d.migrateIdScopes(sess)
}

func (d *dashboardUidPermissionMigrator) migrateWildcards(sess *xorm.Session) error {
	if _, err := sess.Exec("DELETE FROM permission WHERE action = 'dashboards:create' AND scope LIKE 'dashboards%'"); err != nil {
		return err
	}
	if _, err := sess.Exec("UPDATE permission SET scope = 'dashboards:uid:*' WHERE scope = 'dashboards:id:*'"); err != nil {
		return err
	}
	if _, err := sess.Exec("UPDATE permission SET scope = 'folders:uid:*' WHERE scope = 'folders:id:*'"); err != nil {
		return err
	}
	return nil
}

func (d *dashboardUidPermissionMigrator) migrateIdScopes(sess *xorm.Session) error {
	type dashboard struct {
		ID       int64  `xorm:"id"`
		UID      string `xorm:"uid"`
		IsFolder bool
	}
	var dashboards []dashboard
	if err := sess.SQL("SELECT id, uid, is_folder FROM dashboard").Find(&dashboards); err != nil {
		return err
	}

	for _, d := range dashboards {
		var idScope string
		var uidScope string

		if d.IsFolder {
			idScope = ac.Scope("folders", "id", strconv.FormatInt(d.ID, 10))
			uidScope = ac.Scope("folders", "uid", d.UID)
		} else {
			idScope = ac.Scope("dashboards", "id", strconv.FormatInt(d.ID, 10))
			uidScope = ac.Scope("dashboards", "uid", d.UID)
		}

		if _, err := sess.Exec("UPDATE permission SET scope = ? WHERE scope = ?", uidScope, idScope); err != nil {
			return err
		}
	}
	return nil
}

type managedFolderCreateAction struct {
	migrator.MigrationBase
}

func (m *managedFolderCreateAction) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *managedFolderCreateAction) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	if _, err := sess.Exec("DELETE FROM permission WHERE action = 'folders:create' AND scope LIKE 'folders:uid:%'"); err != nil {
		return err
	}
	return nil
}

const managedFolderAlertActionsMigratorID = "managed folder permissions alert actions migration"

func AddManagedFolderAlertActionsMigration(mg *migrator.Migrator) {
	mg.AddMigration(managedFolderAlertActionsMigratorID, &managedFolderAlertActionsMigrator{})
}

type managedFolderAlertActionsMigrator struct {
	migrator.MigrationBase
}

func (m *managedFolderAlertActionsMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *managedFolderAlertActionsMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var ids []interface{}
	if err := sess.SQL("SELECT id FROM role WHERE name LIKE 'managed:%'").Find(&ids); err != nil {
		return err
	}

	if len(ids) == 0 {
		return nil
	}

	var permissions []ac.Permission
	if err := sess.SQL("SELECT role_id, action, scope FROM permission WHERE role_id IN(?"+strings.Repeat(" ,?", len(ids)-1)+") AND scope LIKE 'folders:%'", ids...).Find(&permissions); err != nil {
		return err
	}

	mapped := make(map[int64]map[string][]ac.Permission, len(ids)-1)
	for _, p := range permissions {
		if mapped[p.RoleID] == nil {
			mapped[p.RoleID] = make(map[string][]ac.Permission)
		}
		mapped[p.RoleID][p.Scope] = append(mapped[p.RoleID][p.Scope], p)
	}

	var toAdd []ac.Permission
	now := time.Now()

	for id, a := range mapped {
		for scope, p := range a {
			if hasFolderView(p) {
				toAdd = append(toAdd, ac.Permission{
					RoleID:  id,
					Updated: now,
					Created: now,
					Scope:   scope,
					Action:  ac.ActionAlertingRuleRead,
				})
			}

			if hasFolderAdmin(p) || hasFolderEdit(p) {
				toAdd = append(
					toAdd,
					ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionAlertingRuleCreate,
					},
					ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionAlertingRuleDelete,
					},
					ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionAlertingRuleUpdate,
					},
				)
			}
		}
	}

	if len(toAdd) == 0 {
		return nil
	}

	err := batch(len(toAdd), batchSize, func(start, end int) error {
		if _, err := sess.InsertMulti(toAdd[start:end]); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return err
	}

	return nil
}

const managedFolderAlertActionsRepeatMigratorID = "managed folder permissions alert actions repeated migration"

/*
AddManagedFolderAlertActionsMigration has to be run after AddDashboardPermissionsMigrator, as it is only effective if dashboard permissions have already been migrated.
AddManagedFolderAlertActionsRepeatMigrator ensures that alerting permissions that have already been added won't get added twice.
*/
func AddManagedFolderAlertActionsRepeatMigration(mg *migrator.Migrator) {
	mg.AddMigration(managedFolderAlertActionsRepeatMigratorID, &managedFolderAlertActionsRepeatMigrator{})
}

type managedFolderAlertActionsRepeatMigrator struct {
	migrator.MigrationBase
}

func (m *managedFolderAlertActionsRepeatMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *managedFolderAlertActionsRepeatMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var ids []interface{}
	if err := sess.SQL("SELECT id FROM role WHERE name LIKE 'managed:%'").Find(&ids); err != nil {
		return err
	}

	if len(ids) == 0 {
		return nil
	}

	var permissions []ac.Permission
	if err := sess.SQL("SELECT role_id, action, scope FROM permission WHERE role_id IN(?"+strings.Repeat(" ,?", len(ids)-1)+") AND scope LIKE 'folders:%'", ids...).Find(&permissions); err != nil {
		return err
	}

	mapped := make(map[int64]map[string][]ac.Permission, len(ids)-1)
	for _, p := range permissions {
		if mapped[p.RoleID] == nil {
			mapped[p.RoleID] = make(map[string][]ac.Permission)
		}
		mapped[p.RoleID][p.Scope] = append(mapped[p.RoleID][p.Scope], p)
	}

	var toAdd []ac.Permission
	now := time.Now()

	for id, a := range mapped {
		for scope, p := range a {
			if hasFolderView(p) {
				if !hasAction(ac.ActionAlertingRuleRead, permissions) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionAlertingRuleRead,
					})
				}
			}

			if hasFolderAdmin(p) || hasFolderEdit(p) {
				if !hasAction(ac.ActionAlertingRuleCreate, permissions) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionAlertingRuleCreate,
					})
				}
				if !hasAction(ac.ActionAlertingRuleDelete, permissions) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionAlertingRuleDelete,
					})
				}
				if !hasAction(ac.ActionAlertingRuleUpdate, permissions) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionAlertingRuleUpdate,
					})
				}
			}
		}
	}

	if len(toAdd) == 0 {
		return nil
	}

	err := batch(len(toAdd), batchSize, func(start, end int) error {
		if _, err := sess.InsertMulti(toAdd[start:end]); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return err
	}

	return nil
}

func hasFolderAdmin(permissions []ac.Permission) bool {
	return hasActions(folderPermissionTranslation[models.PERMISSION_ADMIN], permissions)
}

func hasFolderEdit(permissions []ac.Permission) bool {
	return hasActions(folderPermissionTranslation[models.PERMISSION_EDIT], permissions)
}

func hasFolderView(permissions []ac.Permission) bool {
	return hasActions(folderPermissionTranslation[models.PERMISSION_VIEW], permissions)
}

func hasActions(actions []string, permissions []ac.Permission) bool {
	var contains int
	for _, action := range actions {
		for _, p := range permissions {
			if action == p.Action {
				contains++
				break
			}
		}
	}
	return contains >= len(actions)
}

func hasAction(action string, permissions []ac.Permission) bool {
	return hasActions([]string{action}, permissions)
}
