package accesscontrol

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

var dashboardPermissionTranslation = map[dashboardaccess.PermissionType][]string{
	dashboardaccess.PERMISSION_VIEW: {
		dashboards.ActionDashboardsRead,
	},
	dashboardaccess.PERMISSION_EDIT: {
		dashboards.ActionDashboardsRead,
		dashboards.ActionDashboardsWrite,
		dashboards.ActionDashboardsDelete,
	},
	dashboardaccess.PERMISSION_ADMIN: {
		dashboards.ActionDashboardsRead,
		dashboards.ActionDashboardsWrite,
		dashboards.ActionDashboardsCreate,
		dashboards.ActionDashboardsDelete,
		dashboards.ActionDashboardsPermissionsRead,
		dashboards.ActionDashboardsPermissionsWrite,
	},
}

var folderPermissionTranslation = map[dashboardaccess.PermissionType][]string{
	dashboardaccess.PERMISSION_VIEW: append(dashboardPermissionTranslation[dashboardaccess.PERMISSION_VIEW], []string{
		dashboards.ActionFoldersRead,
	}...),
	dashboardaccess.PERMISSION_EDIT: append(dashboardPermissionTranslation[dashboardaccess.PERMISSION_EDIT], []string{
		dashboards.ActionDashboardsCreate,
		dashboards.ActionFoldersRead,
		dashboards.ActionFoldersWrite,
		dashboards.ActionFoldersDelete,
	}...),
	dashboardaccess.PERMISSION_ADMIN: append(dashboardPermissionTranslation[dashboardaccess.PERMISSION_ADMIN], []string{
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
	HasAcl   bool `xorm:"has_acl"`
}

func (m dashboardPermissionsMigrator) Exec(sess *xorm.Session, migrator *migrator.Migrator) error {
	m.sess = sess
	m.dialect = migrator.Dialect

	var dashs []dashboard
	if err := m.sess.SQL("SELECT id, is_folder, folder_id, org_id, has_acl FROM dashboard").Find(&dashs); err != nil {
		return fmt.Errorf("failed to list dashboards: %w", err)
	}

	var acl []dashboards.DashboardACL
	if err := m.sess.Find(&acl); err != nil {
		return fmt.Errorf("failed to list dashboard ACL: %w", err)
	}

	aclMap := make(map[int64][]dashboards.DashboardACL, len(acl))
	for _, p := range acl {
		aclMap[p.DashboardID] = append(aclMap[p.DashboardID], p)
	}

	if err := m.migratePermissions(dashs, aclMap, migrator); err != nil {
		return fmt.Errorf("failed to migrate permissions: %w", err)
	}

	return nil
}

func (m dashboardPermissionsMigrator) migratePermissions(dashes []dashboard, aclMap map[int64][]dashboards.DashboardACL, migrator *migrator.Migrator) error {
	permissionMap := map[int64]map[string][]*ac.Permission{}
	for _, d := range dashes {
		if d.ID == -1 {
			continue
		}
		acls := aclMap[d.ID]
		if permissionMap[d.OrgID] == nil {
			permissionMap[d.OrgID] = map[string][]*ac.Permission{}
		}

		if (d.IsFolder || d.FolderID == 0) && len(acls) == 0 && !d.HasAcl {
			permissionMap[d.OrgID]["managed:builtins:editor:permissions"] = append(
				permissionMap[d.OrgID]["managed:builtins:editor:permissions"],
				m.mapPermission(d.ID, dashboardaccess.PERMISSION_EDIT, d.IsFolder)...,
			)
			permissionMap[d.OrgID]["managed:builtins:viewer:permissions"] = append(
				permissionMap[d.OrgID]["managed:builtins:viewer:permissions"],
				m.mapPermission(d.ID, dashboardaccess.PERMISSION_VIEW, d.IsFolder)...,
			)
		} else {
			for _, a := range deduplicateAcl(acls) {
				roleName := getRoleName(a)
				permissionMap[d.OrgID][roleName] = append(
					permissionMap[d.OrgID][roleName],
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

	allRoles = append(allRoles, createdRoles...)

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

func (m dashboardPermissionsMigrator) mapPermission(id int64, p dashboardaccess.PermissionType, isFolder bool) []*ac.Permission {
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

func getRoleName(p dashboards.DashboardACL) string {
	if p.UserID != 0 {
		return fmt.Sprintf("managed:users:%d:permissions", p.UserID)
	}
	if p.TeamID != 0 {
		return fmt.Sprintf("managed:teams:%d:permissions", p.TeamID)
	}
	return fmt.Sprintf("managed:builtins:%s:permissions", strings.ToLower(string(*p.Role)))
}

func deduplicateAcl(acl []dashboards.DashboardACL) []dashboards.DashboardACL {
	output := make([]dashboards.DashboardACL, 0, len(acl))
	uniqueACL := map[string]dashboards.DashboardACL{}
	for _, item := range acl {
		// acl items with userID or teamID is enforced to be unique by sql constraint, so we can skip those
		if item.UserID > 0 || item.TeamID > 0 {
			output = append(output, item)
			continue
		}

		// better to make sure so we don't panic
		if item.Role == nil {
			continue
		}

		current, ok := uniqueACL[string(*item.Role)]
		if !ok {
			uniqueACL[string(*item.Role)] = item
			continue
		}

		if current.Permission < item.Permission {
			uniqueACL[string(*item.Role)] = item
		}
	}

	for _, item := range uniqueACL {
		output = append(output, item)
	}

	return output
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
	var ids []any
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

const managedFolderAlertActionsRepeatMigratorFixedID = "managed folder permissions alert actions repeated fixed migration"

/*
AddManagedFolderAlertActionsRepeatFixedMigration is a fixed version of AddManagedFolderAlertActionsRepeatMigration.
*/
func AddManagedFolderAlertActionsRepeatFixedMigration(mg *migrator.Migrator) {
	mg.AddMigration(managedFolderAlertActionsRepeatMigratorFixedID, &managedFolderAlertActionsRepeatMigrator{})
}

type managedFolderAlertActionsRepeatMigrator struct {
	migrator.MigrationBase
}

func (m *managedFolderAlertActionsRepeatMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *managedFolderAlertActionsRepeatMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var ids []any
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
			// previous migration added this permission, but it was not added to the toAdd slice
			// because we were checking all permissions on top of folders, not just the scoped ones
			//
			// what we had:
			// if !hasAction(ac.<Action>, permissions) {
			// should have been:
			// if !hasAction(ac.<Action>, p) {
			//
			// see PR for explanation: https://github.com/grafana/grafana/pull/58054
			if hasFolderView(p) {
				if !hasAction(ac.ActionAlertingRuleRead, p) {
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
				if !hasAction(ac.ActionAlertingRuleCreate, p) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionAlertingRuleCreate,
					})
				}
				if !hasAction(ac.ActionAlertingRuleDelete, p) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionAlertingRuleDelete,
					})
				}
				if !hasAction(ac.ActionAlertingRuleUpdate, p) {
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

const managedFolderLibraryPanelActionsMigratorID = "managed folder permissions library panel actions migration"

func AddManagedFolderLibraryPanelActionsMigration(mg *migrator.Migrator) {
	mg.AddMigration(managedFolderLibraryPanelActionsMigratorID, &managedFolderLibraryPanelActionsMigrator{})
}

type managedFolderLibraryPanelActionsMigrator struct {
	migrator.MigrationBase
}

func (m *managedFolderLibraryPanelActionsMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

// TODO: Refactor with alerts migration
func (m *managedFolderLibraryPanelActionsMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var ids []any
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
				if !hasAction(ac.ActionLibraryPanelsRead, p) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionLibraryPanelsRead,
					})
				}
			}

			if hasFolderAdmin(p) || hasFolderEdit(p) {
				if !hasAction(ac.ActionLibraryPanelsCreate, p) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionLibraryPanelsCreate,
					})
				}
				if !hasAction(ac.ActionLibraryPanelsDelete, p) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionLibraryPanelsDelete,
					})
				}
				if !hasAction(ac.ActionLibraryPanelsWrite, p) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:  id,
						Updated: now,
						Created: now,
						Scope:   scope,
						Action:  ac.ActionLibraryPanelsWrite,
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

const ManagedDashboardAnnotationActionsMigratorID = "managed dashboard permissions annotation actions migration"

func AddManagedDashboardAnnotationActionsMigration(mg *migrator.Migrator) {
	mg.AddMigration(ManagedDashboardAnnotationActionsMigratorID, &managedDashboardAnnotationActionsMigrator{})
}

type managedDashboardAnnotationActionsMigrator struct {
	migrator.MigrationBase
}

func (m *managedDashboardAnnotationActionsMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *managedDashboardAnnotationActionsMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	// Check if roles have been populated and return early if they haven't - this avoids logging a warning from hasDefaultAnnotationPermissions
	roleCount := 0
	_, err := sess.SQL(`SELECT COUNT( DISTINCT r.uid ) FROM role AS r INNER JOIN permission AS p ON r.id = p.role_id WHERE r.uid IN (?, ?, ?)`, "basic_viewer", "basic_editor", "basic_admin").Get(&roleCount)
	if err != nil {
		return fmt.Errorf("failed to check if basic roles have been populated: %w", err)
	}
	// Role count will be 0 either for new Grafana installations (in that case no managed roles will exist either, and the next conditional will return nil)
	// or for OSS instances, for which basic role permissions can't be changed, so we don't need to run the default permission check in that case.
	if roleCount != 0 {
		// Check that default annotation permissions are assigned to basic roles. If that is not the case, skip the migration.
		if hasDefaultPerms, err := m.hasDefaultAnnotationPermissions(sess, mg); err != nil || !hasDefaultPerms {
			return err
		}
	}

	var ids []any
	if err := sess.SQL("SELECT id FROM role WHERE name LIKE 'managed:%'").Find(&ids); err != nil {
		return err
	}

	if len(ids) == 0 {
		return nil
	}

	var permissions []ac.Permission
	roleQueryBatchSize := 100
	err = batch(len(ids), roleQueryBatchSize, func(start, end int) error {
		var batchPermissions []ac.Permission
		if err := sess.SQL("SELECT role_id, action, scope FROM permission WHERE role_id IN(?"+strings.Repeat(" ,?", len(ids[start:end])-1)+") AND (scope LIKE 'folders:%' or scope LIKE 'dashboards:%')", ids[start:end]...).Find(&batchPermissions); err != nil {
			return err
		}
		permissions = append(permissions, batchPermissions...)
		return nil
	})
	if err != nil {
		return err
	}

	mapped := make(map[int64]map[string]map[string]bool, len(ids)-1)
	for _, p := range permissions {
		if mapped[p.RoleID] == nil {
			mapped[p.RoleID] = make(map[string]map[string]bool)
		}
		if mapped[p.RoleID][p.Scope] == nil {
			mapped[p.RoleID][p.Scope] = make(map[string]bool)
		}
		mapped[p.RoleID][p.Scope][p.Action] = true
	}

	var toAdd []ac.Permission
	now := time.Now()

	for roleId, mappedPermissions := range mapped {
		for scope, roleActions := range mappedPermissions {
			// Create a temporary permission to split the scope into kind, attribute and identifier
			tempPerm := ac.Permission{
				Scope: scope,
			}
			kind, attribute, identifier := tempPerm.SplitScope()
			if roleActions[dashboards.ActionDashboardsRead] {
				if !roleActions[ac.ActionAnnotationsRead] {
					toAdd = append(toAdd, ac.Permission{
						RoleID:     roleId,
						Updated:    now,
						Created:    now,
						Scope:      scope,
						Action:     ac.ActionAnnotationsRead,
						Kind:       kind,
						Attribute:  attribute,
						Identifier: identifier,
					})
				}
			}

			if roleActions[dashboards.ActionDashboardsWrite] {
				if !roleActions[ac.ActionAnnotationsCreate] {
					toAdd = append(toAdd, ac.Permission{
						RoleID:     roleId,
						Updated:    now,
						Created:    now,
						Scope:      scope,
						Action:     ac.ActionAnnotationsCreate,
						Kind:       kind,
						Attribute:  attribute,
						Identifier: identifier,
					})
				}
				if !roleActions[ac.ActionAnnotationsDelete] {
					toAdd = append(toAdd, ac.Permission{
						RoleID:     roleId,
						Updated:    now,
						Created:    now,
						Scope:      scope,
						Action:     ac.ActionAnnotationsDelete,
						Kind:       kind,
						Attribute:  attribute,
						Identifier: identifier,
					})
				}
				if !roleActions[ac.ActionAnnotationsWrite] {
					toAdd = append(toAdd, ac.Permission{
						RoleID:     roleId,
						Updated:    now,
						Created:    now,
						Scope:      scope,
						Action:     ac.ActionAnnotationsWrite,
						Kind:       kind,
						Attribute:  attribute,
						Identifier: identifier,
					})
				}
			}
		}
	}

	if len(toAdd) == 0 {
		return nil
	}

	return batch(len(toAdd), batchSize, func(start, end int) error {
		_, err := sess.InsertMulti(toAdd[start:end])
		return err
	})
}

func (m *managedDashboardAnnotationActionsMigrator) hasDefaultAnnotationPermissions(sess *xorm.Session, mg *migrator.Migrator) (bool, error) {
	type basicRolePermission struct {
		Uid    string
		Action string
		Scope  string
	}

	var basicRolePermissions []basicRolePermission
	basicRoleUIDs := []any{"basic_viewer", "basic_editor", "basic_admin"}
	query := `SELECT r.uid, p.action, p.scope FROM role r
LEFT OUTER JOIN permission p ON p.role_id = r.id
WHERE r.uid IN (?, ?, ?) AND p.action LIKE 'annotations:%' AND p.scope IN ('*', 'annotations:*', 'annotations:type:*', 'annotations:type:dashboard')
`
	if err := sess.SQL(query, basicRoleUIDs...).Find(&basicRolePermissions); err != nil {
		return false, fmt.Errorf("failed to list basic role permissions: %w", err)
	}

	mappedBasicRolePerms := make(map[string]map[string]bool, 0)
	for _, p := range basicRolePermissions {
		if mappedBasicRolePerms[p.Uid] == nil {
			mappedBasicRolePerms[p.Uid] = make(map[string]bool)
		}
		mappedBasicRolePerms[p.Uid][p.Action] = true
	}

	expectedAnnotationActions := []string{ac.ActionAnnotationsRead, ac.ActionAnnotationsCreate, ac.ActionAnnotationsDelete, ac.ActionAnnotationsWrite}

	for _, uid := range basicRoleUIDs {
		if mappedBasicRolePerms[uid.(string)] == nil {
			mg.Logger.Warn("basic role permissions missing annotation permissions, skipping annotation permission migration", "uid", uid)
			return false, nil
		}
		for _, action := range expectedAnnotationActions {
			if !mappedBasicRolePerms[uid.(string)][action] {
				mg.Logger.Warn("basic role permissions missing annotation permissions, skipping annotation permission migration", "uid", uid, "action", action)
				return false, nil
			}
		}
	}
	return true, nil
}

const ManagedFolderAlertingSilencesActionsMigratorID = "managed folder permissions alerting silences actions migration"

func AddManagedFolderAlertingSilencesActionsMigrator(mg *migrator.Migrator) {
	mg.AddMigration(ManagedFolderAlertingSilencesActionsMigratorID, &managedFolderAlertingSilencesActionsMigrator{})
}

type managedFolderAlertingSilencesActionsMigrator struct {
	migrator.MigrationBase
}

func (m *managedFolderAlertingSilencesActionsMigrator) SQL(_ migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *managedFolderAlertingSilencesActionsMigrator) Exec(sess *xorm.Session, _ *migrator.Migrator) error {
	var ids []any
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
			// Create a temporary permission to split the scope into kind, attribute and identifier
			kind, attribute, identifier := ac.Permission{Scope: scope}.SplitScope()

			if hasFolderView(p) {
				if !hasAction(ac.ActionAlertingSilencesRead, p) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:     id,
						Action:     ac.ActionAlertingSilencesRead,
						Scope:      scope,
						Kind:       kind,
						Attribute:  attribute,
						Identifier: identifier,
						Updated:    now,
						Created:    now,
					})
				}
			}

			if hasFolderAdmin(p) || hasFolderEdit(p) {
				if !hasAction(ac.ActionAlertingSilencesCreate, p) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:     id,
						Action:     ac.ActionAlertingSilencesCreate,
						Scope:      scope,
						Kind:       kind,
						Attribute:  attribute,
						Identifier: identifier,
						Updated:    now,
						Created:    now,
					})
				}
				if !hasAction(ac.ActionAlertingSilencesWrite, p) {
					toAdd = append(toAdd, ac.Permission{
						RoleID:     id,
						Action:     ac.ActionAlertingSilencesWrite,
						Scope:      scope,
						Kind:       kind,
						Attribute:  attribute,
						Identifier: identifier,
						Updated:    now,
						Created:    now,
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
	return hasActions(folderPermissionTranslation[dashboardaccess.PERMISSION_ADMIN], permissions)
}

func hasFolderEdit(permissions []ac.Permission) bool {
	return hasActions(folderPermissionTranslation[dashboardaccess.PERMISSION_EDIT], permissions)
}

func hasFolderView(permissions []ac.Permission) bool {
	return hasActions(folderPermissionTranslation[dashboardaccess.PERMISSION_VIEW], permissions)
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
