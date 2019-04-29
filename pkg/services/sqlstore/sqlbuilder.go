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
	okRoles := []interface{}{user.OrgRole}

	sb.sql.WriteString(`
		(
			SELECT d_id, SUM(CASE WHEN da_did=d_id THEN 1 ELSE 0 END) as dashboard_count,SUM(CASE WHEN da_did=f_id THEN 1 ELSE 0 END) as folder_count,
				SUM(CASE WHEN da_did=child_id THEN 1 ELSE  0 END) as child_count, SUM(CASE WHEN da_did = -1 THEN 1 ELSE 0 END) as default_count
			FROM (
			  SELECT d.id as d_id, folder.id as f_id, child_dashboard.id as child_id, da.dashboard_id as da_did
			  FROM dashboard AS d
			  LEFT JOIN dashboard folder on folder.id = d.folder_id
			  LEFT JOIN dashboard child_dashboard on child_dashboard.folder_id = d.id
			  LEFT JOIN dashboard_acl AS da ON
	 			  da.dashboard_id = d.id OR
	 			  da.dashboard_id = d.folder_id OR
				  da.dashboard_id = child_dashboard.id OR
	 			  (
	 				  -- include default permissions -->
					  da.org_id = -1 AND (
					    (folder.id IS NOT NULL AND folder.has_acl = ` + falseStr + `) OR
					    (folder.id IS NULL AND d.has_acl = ` + falseStr + `)
					  )
	 			  )
			  LEFT JOIN team_member as ugm on ugm.team_id = da.team_id
			  WHERE
				  d.org_id = ? AND
				  da.permission >= ? AND
				  (
					  da.user_id = ? OR
					  ugm.user_id = ? OR
					  da.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
				  )
      		) as p
      		GROUP BY d_id
		) 
	`)

	sb.params = append(sb.params, user.OrgId, permission, user.UserId, user.UserId)
	sb.params = append(sb.params, okRoles...)
}
