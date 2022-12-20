package permissions

import (
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
)

type DashboardPermissionFilter struct {
	OrgRole         org.RoleType
	Dialect         migrator.Dialect
	UserId          int64
	OrgId           int64
	PermissionLevel models.PermissionType
}

func (d DashboardPermissionFilter) Where() (string, []interface{}) {
	if d.OrgRole == org.RoleAdmin {
		return "", nil
	}

	okRoles := []interface{}{d.OrgRole}
	if d.OrgRole == org.RoleEditor {
		okRoles = append(okRoles, org.RoleViewer)
	}

	falseStr := d.Dialect.BooleanStr(false)

	sql := `(
		dashboard.id IN (
			SELECT distinct DashboardId from (
				SELECT d.id AS DashboardId
					FROM dashboard AS d
					LEFT JOIN dashboard_acl AS da ON
						da.dashboard_id = d.id OR
						da.dashboard_id = d.folder_id
					WHERE
						d.org_id = ? AND
						da.permission >= ? AND
						(
							da.user_id = ? OR
							da.team_id IN (SELECT team_id from team_member AS tm WHERE tm.user_id = ?) OR
							da.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
						)
				UNION
				SELECT d.id AS DashboardId
					FROM dashboard AS d
					LEFT JOIN dashboard AS folder on folder.id = d.folder_id
					LEFT JOIN dashboard_acl AS da ON
						(
							-- include default permissions -->
							da.org_id = -1 AND (
							  (folder.id IS NOT NULL AND folder.has_acl = ` + falseStr + `) OR
							  (folder.id IS NULL AND d.has_acl = ` + falseStr + `)
							)
						)
					WHERE
						d.org_id = ? AND
						da.permission >= ? AND
						(
							da.user_id = ? OR
							da.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
						)
			) AS a
		)
	)
	`

	params := []interface{}{d.OrgId, d.PermissionLevel, d.UserId, d.UserId}
	params = append(params, okRoles...)
	params = append(params, d.OrgId, d.PermissionLevel, d.UserId)
	params = append(params, okRoles...)
	return sql, params
}

type AccessControlDashboardPermissionFilter struct {
	user            *user.SignedInUser
	dashboardAction string
	folderActions   []string
}

// NewAccessControlDashboardPermissionFilter creates a new AccessControlDashboardPermissionFilter that is configured with specific actions calculated based on the models.PermissionType and query type
func NewAccessControlDashboardPermissionFilter(user *user.SignedInUser, permissionLevel models.PermissionType, queryType string) AccessControlDashboardPermissionFilter {
	needEdit := permissionLevel > models.PERMISSION_VIEW

	var dashboardAction string
	var folderActions []string
	if queryType == searchstore.TypeFolder {
		folderActions = append(folderActions, dashboards.ActionFoldersRead)
		if needEdit {
			folderActions = append(folderActions, dashboards.ActionDashboardsCreate)
		}
	} else if queryType == searchstore.TypeAlertFolder {
		folderActions = append(
			folderActions,
			dashboards.ActionFoldersRead,
			accesscontrol.ActionAlertingRuleRead,
		)
		if needEdit {
			folderActions = append(
				folderActions,
				accesscontrol.ActionAlertingRuleCreate,
			)
		}
	} else if queryType == searchstore.TypeDashboard {
		dashboardAction = dashboards.ActionDashboardsRead
		if needEdit {
			dashboardAction = dashboards.ActionDashboardsWrite
		}
	} else {
		dashboardAction = dashboards.ActionDashboardsRead
		folderActions = append(folderActions, dashboards.ActionFoldersRead)
		if needEdit {
			folderActions = append(folderActions, dashboards.ActionDashboardsCreate)
		}
	}

	return AccessControlDashboardPermissionFilter{user: user, folderActions: folderActions, dashboardAction: dashboardAction}
}

func (f AccessControlDashboardPermissionFilter) Where() (string, []interface{}) {
	if f.user == nil || f.user.Permissions == nil || f.user.Permissions[f.user.OrgID] == nil {
		return "(1 = 0)", nil
	}
	dashWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeDashboardsPrefix)
	folderWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeFoldersPrefix)

	filter, params := accesscontrol.UserRolesFilter(f.user.OrgID, f.user.UserID, f.user.Teams, accesscontrol.GetOrgRoles(f.user))
	rolesFilter := "AND role_id IN(SELECT distinct id FROM role " + filter + ")"
	var args []interface{}
	builder := strings.Builder{}
	builder.WriteRune('(')
	if f.dashboardAction != "" {
		var hasWildcard bool
		for _, scope := range f.user.Permissions[f.user.OrgID][f.dashboardAction] {
			if dashWildcards.Contains(scope) || folderWildcards.Contains(scope) {
				hasWildcard = true
				break
			}
		}
		if !hasWildcard {
			builder.WriteString("(dashboard.uid IN (SELECT substr(scope, 16) FROM permission WHERE action = ? AND scope LIKE 'dashboards:uid:%' " + rolesFilter + ") AND NOT dashboard.is_folder)")
			args = append(args, f.dashboardAction)
			args = append(args, params...)

			builder.WriteString(" OR ")
			builder.WriteString("(dashboard.folder_id IN (SELECT id FROM dashboard as d WHERE d.uid IN (SELECT substr(scope, 13) FROM permission WHERE action = ? AND scope LIKE 'folders:uid:%' " + rolesFilter + ")) AND NOT dashboard.is_folder)")
			args = append(args, f.dashboardAction)
			args = append(args, params...)
		} else {
			builder.WriteString("NOT dashboard.is_folder")
		}
	}

	if len(f.folderActions) > 0 {
		if f.dashboardAction != "" {
			builder.WriteString(" OR ")
		}

		actionsToCheck := make([]interface{}, 0, len(f.folderActions))
		for _, action := range f.folderActions {
			var hasWildcard bool
			for _, scope := range f.user.Permissions[f.user.OrgID][action] {
				if folderWildcards.Contains(scope) {
					hasWildcard = true
					break
				}
			}
			if !hasWildcard {
				actionsToCheck = append(actionsToCheck, action)
			}
		}

		if len(actionsToCheck) > 0 {
			builder.WriteString("(dashboard.uid IN (SELECT substr(scope, 13) FROM permission WHERE action IN (?" + strings.Repeat(", ?", len(actionsToCheck)-1) + ") AND scope LIKE 'folders:uid:%' " + rolesFilter + " GROUP BY role_id, scope HAVING COUNT(action) = ?) AND dashboard.is_folder)")
			args = append(args, actionsToCheck...)
			args = append(args, params...)
			args = append(args, len(actionsToCheck))
		} else {
			builder.WriteString("dashboard.is_folder")
		}
	}
	builder.WriteRune(')')
	return builder.String(), args
}
