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
	User             *user.SignedInUser
	dashboardActions []string
	folderActions    []string
}

// NewAccessControlDashboardPermissionFilter creates a new AccessControlDashboardPermissionFilter that is configured with specific actions calculated based on the models.PermissionType and query type
func NewAccessControlDashboardPermissionFilter(user *user.SignedInUser, permissionLevel models.PermissionType, queryType string) AccessControlDashboardPermissionFilter {
	needEdit := permissionLevel > models.PERMISSION_VIEW
	folderActions := []string{dashboards.ActionFoldersRead}
	var dashboardActions []string
	if queryType == searchstore.TypeAlertFolder {
		folderActions = append(folderActions, accesscontrol.ActionAlertingRuleRead)
		if needEdit {
			folderActions = append(folderActions, accesscontrol.ActionAlertingRuleCreate)
		}
	} else {
		dashboardActions = append(dashboardActions, dashboards.ActionDashboardsRead)
		if needEdit {
			folderActions = append(folderActions, dashboards.ActionDashboardsCreate)
			dashboardActions = append(dashboardActions, dashboards.ActionDashboardsWrite)
		}
	}
	return AccessControlDashboardPermissionFilter{User: user, folderActions: folderActions, dashboardActions: dashboardActions}
}

func (f AccessControlDashboardPermissionFilter) Where() (string, []interface{}) {
	var args []interface{}
	builder := strings.Builder{}
	builder.WriteString("(")

	if len(f.dashboardActions) > 0 {
		builder.WriteString("((")

		dashFilter, _ := accesscontrol.Filter(f.User, "dashboard.uid", dashboards.ScopeDashboardsPrefix, f.dashboardActions...)
		builder.WriteString(dashFilter.Where)
		args = append(args, dashFilter.Args...)

		builder.WriteString(" OR dashboard.folder_id IN(SELECT id FROM dashboard WHERE ")
		dashFolderFilter, _ := accesscontrol.Filter(f.User, "dashboard.uid", dashboards.ScopeFoldersPrefix, f.dashboardActions...)

		builder.WriteString(dashFolderFilter.Where)
		builder.WriteString(")) AND NOT dashboard.is_folder)")
		args = append(args, dashFolderFilter.Args...)
	}

	if len(f.folderActions) > 0 {
		if len(f.dashboardActions) > 0 {
			builder.WriteString(" OR ")
		}
		builder.WriteString("(")
		folderFilter, _ := accesscontrol.Filter(f.User, "dashboard.uid", dashboards.ScopeFoldersPrefix, f.folderActions...)
		builder.WriteString(folderFilter.Where)
		builder.WriteString(" AND dashboard.is_folder)")
		args = append(args, folderFilter.Args...)
	}
	builder.WriteString(")")
	return builder.String(), args
}
