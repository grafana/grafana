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
	folderAction    string
	dashboardAction string
}

// NewAccessControlDashboardPermissionFilter creates a new AccessControlDashboardPermissionFilter that is configured with specific actions calculated based on the models.PermissionType and query type
func NewAccessControlDashboardPermissionFilter(user *user.SignedInUser, permissionLevel models.PermissionType, queryType string) AccessControlDashboardPermissionFilter {
	needEdit := permissionLevel > models.PERMISSION_VIEW
	folderAction := ""
	dashboardAction := ""
	if queryType == searchstore.TypeAlertFolder {
		folderAction = accesscontrol.ActionAlertingRuleRead
		if needEdit {
			folderAction = accesscontrol.ActionAlertingRuleCreate
		}
	} else {
		folderAction = dashboards.ActionFoldersRead
		dashboardAction = dashboards.ActionDashboardsRead
		if needEdit {
			folderAction = dashboards.ActionFoldersWrite
			dashboardAction = dashboards.ActionDashboardsWrite
		}
	}
	return AccessControlDashboardPermissionFilter{user: user, folderAction: folderAction, dashboardAction: dashboardAction}
}

func (f AccessControlDashboardPermissionFilter) Where() (string, []interface{}) {
	if f.user == nil || f.user.Permissions == nil || f.user.Permissions[f.user.OrgID] == nil {
		return "(1 = 0)", nil
	}
	dashWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeDashboardsPrefix)
	folderWildcards := accesscontrol.WildcardsFromPrefix(dashboards.ScopeDashboardsPrefix)

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
				builder.WriteString("(1 = 1 AND NOT dashboard.is_folder)")
			}
		}

		if !hasWildcard {
			builder.WriteString("(dashboard.uid IN (SELECT SUBSTR(scope, 16) as uid FROM permission WHERE action = ? AND scope LIKE 'dashboards:uid:%'  " + rolesFilter + " )")
			builder.WriteString(" OR ")
			builder.WriteString("dashboard.folder_id IN (SELECT id FROM dashboard as d WHERE d.uid IN (SELECT SUBSTR(scope, 13) as uid FROM permission WHERE action = ? AND scope LIKE 'folders:uid:%' " + rolesFilter + " )))")
			args = append(args, f.dashboardAction)
			args = append(args, params...)
			args = append(args, f.dashboardAction)
			args = append(args, params...)
		}
	}

	if f.folderAction != "" {
		if f.dashboardAction != "" {
			builder.WriteString(" OR ")
		}

		var hasWildcard bool
		for _, scope := range f.user.Permissions[f.user.OrgID][f.dashboardAction] {
			if folderWildcards.Contains(scope) {
				hasWildcard = true
				builder.WriteString("(1 = 1 AND dashboard.is_folder)")
			}
		}
		if !hasWildcard {
			builder.WriteString("(dashboard.uid IN (SELECT SUBSTR(scope, 13) as uid FROM permission WHERE action = ? AND scope LIKE 'folders:uid:%' " + rolesFilter + "))")
			args = append(args, f.folderAction)
			args = append(args, params...)
		}
	}
	builder.WriteRune(')')

	return builder.String(), args
}
