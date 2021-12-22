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
        SELECT id FROM
            (SELECT
                   d.id,
                   d.has_acl,
                   d.folder_id,
                   (SELECT f.has_acl FROM dashboard AS f WHERE d.folder_id = f.id) as folder_has_acl,
                   (SELECT COUNT(1) FROM dashboard_acl AS acl
                   WHERE d.id = acl.dashboard_id AND acl.permission >= ?
                     AND (
                            acl.user_id = ?
                            OR acl.team_id IN (SELECT team_id FROM team_member WHERE team_member.user_id = ?)
                            OR acl.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
                        )
                  ) as is_dashboard_allowed,
                  (SELECT COUNT(1) FROM dashboard_acl AS acl
                    WHERE d.folder_id = acl.dashboard_id AND acl.permission >= ?
                      AND (
                            acl.user_id = ?
                            OR acl.team_id IN (SELECT team_id FROM team_member WHERE team_member.user_id = ?)
                            OR acl.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
                        )
                  ) as is_folder_allowed
            FROM dashboard as d
            WHERE d.org_id IN (-1, ?)
        ) AS perm
        WHERE
            (perm.has_acl = ` + falseStr + ` and perm.folder_id = 0)
            OR perm.is_dashboard_allowed = 1 AND perm.folder_id = 0
            OR (perm.folder_id > 0 and perm.folder_has_acl = ` + falseStr + `)
            OR (perm.folder_id > 0 and perm.folder_has_acl = ` + trueStr + ` and perm.is_folder_allowed = 1)
    )
)`

	params := []interface{}{d.PermissionLevel, d.UserId, d.UserId}
	params = append(params, okRoles...)
	params = append(params, d.PermissionLevel, d.UserId, d.UserId)
	params = append(params, okRoles...)
	params = append(params, d.OrgId)
	return sql, params
}
