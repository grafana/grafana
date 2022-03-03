package accesscontrol

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

var dashboardPermissionTranslation = map[models.PermissionType][]string{
	models.PERMISSION_VIEW: {
		ac.ActionDashboardsRead,
	},
	models.PERMISSION_EDIT: {
		ac.ActionDashboardsRead,
		ac.ActionDashboardsWrite,
		ac.ActionDashboardsCreate,
		ac.ActionDashboardsDelete,
	},
	models.PERMISSION_ADMIN: {
		ac.ActionDashboardsRead,
		ac.ActionDashboardsWrite,
		ac.ActionDashboardsCreate,
		ac.ActionDashboardsDelete,
		ac.ActionDashboardsPermissionsRead,
		ac.ActionDashboardsPermissionsWrite,
	},
}

var folderPermissionTranslation = map[models.PermissionType][]string{
	models.PERMISSION_VIEW: append(dashboardPermissionTranslation[models.PERMISSION_VIEW], []string{
		ac.ActionFoldersRead,
	}...),
	models.PERMISSION_EDIT: append(dashboardPermissionTranslation[models.PERMISSION_EDIT], []string{
		ac.ActionFoldersRead,
		ac.ActionFoldersWrite,
		ac.ActionFoldersCreate,
		ac.ActionFoldersDelete,
	}...),
	models.PERMISSION_ADMIN: append(dashboardPermissionTranslation[models.PERMISSION_ADMIN], []string{
		ac.ActionFoldersRead,
		ac.ActionFoldersWrite,
		ac.ActionFoldersCreate,
		ac.ActionFoldersDelete,
		ac.ActionFoldersPermissionsRead,
		ac.ActionFoldersPermissionsWrite,
	}...),
}

func AddDashboardPermissionsMigrator(mg *migrator.Migrator) {
	mg.AddMigration("dashboard permissions", &dashboardPermissionsMigrator{})
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
		return err
	}

	var acl []models.DashboardAcl
	if err := m.sess.Find(&acl); err != nil {
		return err
	}

	aclMap := make(map[int64][]models.DashboardAcl, len(acl))
	for _, p := range acl {
		aclMap[p.DashboardID] = append(aclMap[p.DashboardID], p)
	}

	if err := m.migratePermissions(dashboards, aclMap); err != nil {
		return err
	}

	return nil
}

func (m dashboardPermissionsMigrator) migratePermissions(dashboards []dashboard, aclMap map[int64][]models.DashboardAcl) error {
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
	assignments := map[int64]map[string]struct{}{}
	for orgID, roles := range permissionMap {
		for name := range roles {
			role, err := m.findRole(orgID, name)
			if err != nil {
				return err
			}
			if role.ID == 0 {
				rolesToCreate = append(rolesToCreate, &ac.Role{OrgID: orgID, Name: name})
				if _, ok := assignments[orgID]; !ok {
					assignments[orgID] = map[string]struct{}{}
				}
				assignments[orgID][name] = struct{}{}
			} else {
				allRoles = append(allRoles, &role)
			}
		}
	}

	createdRoles, err := m.bulkCreateRoles(rolesToCreate)
	if err != nil {
		return err
	}

	rolesToAssign := map[int64]map[string]*ac.Role{}
	for i := range createdRoles {
		if _, ok := rolesToAssign[createdRoles[i].OrgID]; !ok {
			rolesToAssign[createdRoles[i].OrgID] = map[string]*ac.Role{}
		}
		rolesToAssign[createdRoles[i].OrgID][createdRoles[i].Name] = createdRoles[i]
		allRoles = append(allRoles, createdRoles[i])
	}

	if err := m.bulkAssignRoles(rolesToAssign, assignments); err != nil {
		return err
	}

	return m.setPermissions(allRoles, permissionMap)
}

func (m dashboardPermissionsMigrator) setPermissions(allRoles []*ac.Role, permissionMap map[int64]map[string][]*ac.Permission) error {
	now := time.Now()
	for _, role := range allRoles {
		if _, err := m.sess.Exec("DELETE FROM permission WHERE role_id = ? AND (action LIKE ? OR action LIKE ?)", role.ID, "dashboards%", "folders%"); err != nil {
			return err
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
			if _, err := m.sess.InsertMulti(permissions[start:end]); err != nil {
				return err
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
		scope := ac.Scope("folders", "id", strconv.FormatInt(id, 10))
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

func getRoleName(p models.DashboardAcl) string {
	if p.UserID != 0 {
		return fmt.Sprintf("managed:users:%d:permissions", p.UserID)
	}
	if p.TeamID != 0 {
		return fmt.Sprintf("managed:teams:%d:permissions", p.TeamID)
	}
	return fmt.Sprintf("managed:builtins:%s:permissions", strings.ToLower(string(*p.Role)))
}
