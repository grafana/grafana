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

func (sb *SqlBuilder) writeDashboardPermissionFilter(user *m.SignedInUser, permission m.PermissionType) {

	if user.OrgRole == m.ROLE_ADMIN {
		return
	}

	okRoles := []interface{}{user.OrgRole}

	if user.OrgRole == m.ROLE_EDITOR {
		okRoles = append(okRoles, m.ROLE_VIEWER)
	}

	// SELECT dash.id, dash.title, dash.folder_id
	// FROM dashboard AS dash
	// 	LEFT JOIN dashboard folder on folder.id = dash.folder_id
	// 	LEFT JOIN dashboard_acl AS da ON
	// 			da.dashboard_id = dash.id OR
	// 			da.dashboard_id = dash.folder_id OR
	// 			(
	// 				-- include default permissions -->
	// 				da.org_id = -1 AND (folder.has_acl = 0 OR (dash.has_acl = 0 AND  dash.folder_id = 0))
	// 			)
	// 	LEFT JOIN team_member as ugm on ugm.team_id =  da.team_id
	// WHERE
	// 	 dash.org_id = 5 AND
	// 	 (
	// 		da.user_id = 8 or
	// 		ugm.user_id = 8 or
	// 		da.role in ('Viewer', 'Editor')
	// 	) AND
	// 	da.permission > 1
	//
	sb.sql.WriteString(` AND
	(
		dashboard.has_acl = ` + dialect.BooleanStr(false) + ` OR
		dashboard.id in (
			SELECT distinct d.id AS DashboardId
			FROM dashboard AS d
				LEFT JOIN dashboard_acl as da on d.folder_id = da.dashboard_id or d.id = da.dashboard_id
				LEFT JOIN team_member as ugm on ugm.team_id =  da.team_id
			WHERE
				d.has_acl = ` + dialect.BooleanStr(true) + ` AND
				d.org_id = ? AND
				da.permission >= ? AND
				(da.user_id = ? or ugm.user_id = ? or da.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `))
		)
	)`)

	sb.params = append(sb.params, user.OrgId, permission, user.UserId, user.UserId)
	sb.params = append(sb.params, okRoles...)
}
