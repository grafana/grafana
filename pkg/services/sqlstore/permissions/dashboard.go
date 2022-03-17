package permissions

import (
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type DashboardPermissionFilter struct {
	OrgRole         models.RoleType
	Dialect         migrator.Dialect
	UserId          int64
	OrgId           int64
	PermissionLevel models.PermissionType
}

func (d DashboardPermissionFilter) Where() (string, []interface{}) {
	if d.OrgRole == models.ROLE_ADMIN {
		return "", nil
	}

	okRoles := []interface{}{d.OrgRole}
	if d.OrgRole == models.ROLE_EDITOR {
		okRoles = append(okRoles, models.ROLE_VIEWER)
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
	User            *models.SignedInUser
	PermissionLevel models.PermissionType
}

func (f AccessControlDashboardPermissionFilter) Where() (string, []interface{}) {
	folderActions := []string{dashboards.ActionFoldersRead}
	dashboardActions := []string{accesscontrol.ActionDashboardsRead}
	if f.PermissionLevel == models.PERMISSION_EDIT {
		folderActions = append(folderActions, accesscontrol.ActionDashboardsCreate)
		dashboardActions = append(dashboardActions, accesscontrol.ActionDashboardsWrite)
	}

	var args []interface{}
	builder := strings.Builder{}
	builder.WriteString("(((")

	dashFilter, _ := accesscontrol.Filter(f.User, "dashboard.id", "dashboards", dashboardActions...)
	builder.WriteString(dashFilter.Where)
	args = append(args, dashFilter.Args...)

	builder.WriteString(" OR ")

	dashFolderFilter, _ := accesscontrol.Filter(f.User, "dashboard.folder_id", "folders", dashboardActions...)
	builder.WriteString(dashFolderFilter.Where)
	builder.WriteString(") AND NOT dashboard.is_folder) OR (")
	args = append(args, dashFolderFilter.Args...)

	folderFilter, _ := accesscontrol.Filter(f.User, "dashboard.id", "folders", folderActions...)
	builder.WriteString(folderFilter.Where)
	builder.WriteString(" AND dashboard.is_folder))")
	args = append(args, folderFilter.Args...)

	return builder.String(), args
}
