package sqlstore

import (
	"bytes"
	"strings"

	m "github.com/grafana/grafana/pkg/models"
)

type SqlBuilder struct {
	sql    bytes.Buffer
	params []interface{}
}

func (sb *SqlBuilder) Write(sql string, params ...interface{}) {
	sb.sql.WriteString(sql)

	if len(params) > 0 {
		sb.params = append(sb.params, params...)
	}
}

func (sb *SqlBuilder) GetSqlString() string {
	return sb.sql.String()
}

func (sb *SqlBuilder) AddParams(params ...interface{}) {
	sb.params = append(sb.params, params...)
}

func (sb *SqlBuilder) buildPermissionsTable(user *m.SignedInUser, permission m.PermissionType) {
	falseStr := dialect.BooleanStr(false)
	trueStr := dialect.BooleanStr(true)
	okRoles := []interface{}{user.OrgRole}

	if user.OrgRole == m.ROLE_EDITOR {
		okRoles = append(okRoles, m.ROLE_VIEWER)
	} else if user.OrgRole == m.ROLE_ADMIN {
		sb.sql.WriteString(`(SELECT id AS d_id, 1 AS viewable, 1 as listable, 1 AS folder_viewable FROM dashboard)`)
		return
	}

	sb.sql.WriteString(`
			(
			SELECT DashboardId as d_id, MAX(viewable) AS viewable, MAX(listable) as listable, MAX(folder_viewable) as folder_viewable FROM (
				SELECT d.id AS DashboardId, 1 as viewable, 1 as listable, CASE WHEN da.dashboard_id = d.folder_id THEN 1 ELSE 0 END as folder_viewable
					FROM dashboard AS d
					LEFT JOIN dashboard AS folder on folder.id = d.folder_id
					LEFT JOIN dashboard_acl AS da ON
						da.dashboard_id = d.id OR
						da.dashboard_id = d.folder_id
					LEFT JOIN team_member as ugm on ugm.team_id = da.team_id
					WHERE
						d.org_id = ? AND
						da.permission >= ? AND
						(
							da.user_id = ? OR
							ugm.user_id = ? OR
							da.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
						)
				-- include permissions from child dashboards -->
				UNION
				SELECT folder.id AS DashboardId, 0 as viewable, 1 as listable, 0 as folder_viewable
					FROM dashboard AS folder
					LEFT JOIN dashboard AS d on folder.id = d.folder_id
					LEFT JOIN dashboard_acl AS da ON
						da.dashboard_id = d.id
					LEFT JOIN team_member as ugm on ugm.team_id = da.team_id
					WHERE
						folder.is_folder = ` + trueStr + ` AND
						d.org_id = ? AND
						da.permission >= ? AND
						(
							da.user_id = ? OR
							ugm.user_id = ? OR
							da.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
						)
				UNION
				SELECT d.id AS DashboardId, 1 as viewable, 1 as listable, CASE WHEN folder.id = d.folder_id THEN 1 ELSE 0 END as folder_viewable
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
			GROUP BY DashboardId
		)
	`)

	sb.params = append(sb.params, user.OrgId, permission, user.UserId, user.UserId)
	sb.params = append(sb.params, okRoles...)
	sb.params = append(sb.params, user.OrgId, permission, user.UserId, user.UserId)
	sb.params = append(sb.params, okRoles...)
	sb.params = append(sb.params, user.OrgId, permission, user.UserId)
	sb.params = append(sb.params, okRoles...)
}
