package permissions

import (
	"strings"

	"github.com/grafana/grafana/pkg/models"
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
	trueStr := d.Dialect.BooleanStr(true)

	sql := `(
    dashboard.id IN (
			SELECT DISTINCT id as DashboardId
				FROM (SELECT perm.*,
							 (SELECT 1
							  FROM dashboard_acl AS acl
							  WHERE perm.has_acl = ` + trueStr + `
								AND perm.id = acl.dashboard_id
								AND acl.permission >= ?
								AND (
										  acl.user_id = ?
									  OR acl.team_id IN
										 (SELECT team_id FROM team_member WHERE team_member.user_id = ?)
									  OR acl.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
								  )
							 ) as is_dashboard_allowed,
							 (SELECT 1
							  FROM dashboard_acl AS acl
							  WHERE perm.folder_id = acl.dashboard_id
								AND acl.permission >= ?
								AND (
										  acl.user_id = ?
									  OR acl.team_id IN
										 (SELECT team_id FROM team_member WHERE team_member.user_id = ?)
									  OR acl.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
								  )
							 ) as is_folder_allowed
					  FROM (SELECT dashboards.*,
								   CASE WHEN (da.user_id = ? OR da.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)) THEN 1 ELSE 0 END as is_default_allowed
							FROM (SELECT d.id,
										 d.has_acl,
										 d.folder_id,
										 d.is_folder,
										 CASE WHEN d.folder_id > 0 THEN 1 ELSE 0 END                        has_folder,
										 (SELECT f.has_acl FROM dashboard AS f WHERE d.folder_id = f.id) as folder_has_acl
								  FROM dashboard as d
								  WHERE org_id IN (-1, ?)
								 ) AS dashboards
									 -- include default permissions -->
									 LEFT JOIN dashboard_acl AS da ON (da.org_id = -1 AND da.permission >= ? AND
																	   ((dashboards.has_folder = 1 AND dashboards.folder_has_acl = ` + falseStr + `) OR
																		(dashboards.has_folder = 0 AND dashboards.has_acl = ` + falseStr + `)))
						   ) AS perm) AS data
				WHERE (is_folder = ` + falseStr + ` AND has_folder = 0 AND (is_default_allowed = 1 OR is_dashboard_allowed = 1))
				   OR (is_folder = ` + falseStr + ` AND has_folder = 1 AND
					   (is_dashboard_allowed = 1 OR is_default_allowed = 1 OR is_folder_allowed = 1))
				   OR (is_folder = ` + trueStr + ` AND is_dashboard_allowed = 1)
				   OR (is_folder = ` + trueStr + ` AND is_default_allowed = 1)
    )
)`

	params := []interface{}{d.PermissionLevel, d.UserId, d.UserId}
	params = append(params, okRoles...)
	params = append(params, d.PermissionLevel, d.UserId, d.UserId)
	params = append(params, okRoles...)
	params = append(params, d.UserId)
	params = append(params, okRoles...)
	params = append(params, d.OrgId)
	params = append(params, d.PermissionLevel)
	return sql, params
}
