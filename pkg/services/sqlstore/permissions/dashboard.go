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
			SELECT id from (
				SELECT id,
				   (SELECT 1
					FROM dashboard_acl AS acl
					WHERE perm.has_acl = ` + falseStr + `
					  AND perm.id = acl.dashboard_id
					  AND acl.permission >= ?
					  AND (
							acl.user_id = ?
							OR acl.team_id IN (SELECT team_id FROM team_member WHERE team_member.user_id = ?)
							OR acl.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
						)
				   ) as is_dashboard_allowed,
				   (SELECT 1
					FROM dashboard_acl AS acl
					WHERE perm.folder_id = acl.dashboard_id
					  AND acl.permission >= ?
					  AND (
							acl.user_id = ?
							OR acl.team_id IN (SELECT team_id FROM team_member WHERE team_member.user_id = ?)
							OR acl.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
						)
				   ) as is_folder_allowed,
				   permission,
				   user_id,
				   role
			FROM (SELECT df.*,
						 da.permission,
						 da.user_id,
						 da.role,
						 CASE
							 WHEN da.permission >= ? AND (da.user_id = ? OR da.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)) THEN 1
							 ELSE 0 END as is_default_allowed
				  FROM (
						   SELECT d.id,
								  d.org_id,
								  d.title,
								  d.has_acl,
								  d.folder_id,
								  CASE WHEN d.folder_id > 0 THEN 1 ELSE 0 END                        has_folder,
								  (SELECT f.has_acl FROM dashboard AS f WHERE d.folder_id = f.id) as folder_has_acl
						   FROM dashboard as d
							 WHERE org_id IN (-1, ?)) df
						   LEFT JOIN dashboard_acl AS da ON
					  (
						  -- include default permissions -->
								  da.org_id = -1 AND (
								  (df.has_folder = 1 AND df.folder_has_acl = ` + falseStr + `) OR
								  (df.has_folder = 0 AND df.has_acl = ` + falseStr + `)
							  )
						  )
				 ) AS perm
			WHERE (has_acl = ` + falseStr + ` and has_folder = 0 and is_default_allowed = 1)
			   OR (has_acl = ` + trueStr + ` and is_dashboard_allowed = 1)
			   OR (has_acl = ` + trueStr + ` and has_folder = 1 and is_folder_allowed = 1)
			   OR (has_folder = 1 and folder_has_acl = ` + falseStr + ` and is_default_allowed = 1)
			   OR (has_folder = 1 and folder_has_acl = ` + trueStr + ` and is_folder_allowed = 1)
			)
    )
)`

	params := []interface{}{d.PermissionLevel, d.UserId, d.UserId}
	params = append(params, okRoles...)
	params = append(params, d.PermissionLevel, d.UserId, d.UserId)
	params = append(params, okRoles...)
	params = append(params, d.PermissionLevel, d.UserId)
	params = append(params, okRoles...)
	params = append(params, d.OrgId)
	return sql, params
}
