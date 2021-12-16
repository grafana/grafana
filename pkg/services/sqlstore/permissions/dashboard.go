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
	sql := `dashboard.id IN (
    	SELECT d.id FROM dashboard as d
    	WHERE d.org_id IN (-1, ?)
        AND (
			d.has_acl = ` + falseStr + `
        	OR (
            	SELECT acl.dashboard_id FROM dashboard_acl AS acl WHERE d.id = acl.dashboard_id
            	AND acl.permission >= ?
            	AND (
                	acl.user_id = ?
                	OR acl.team_id IN (SELECT team_id FROM team_member WHERE team_member.user_id = ?)
                	OR acl.role IN (?` + strings.Repeat(",?", len(okRoles)-1) + `)
            	)
        	)
		)
	)`

	params := []interface{}{d.OrgId, d.PermissionLevel, d.UserId, d.UserId}
	params = append(params, okRoles...)
	return sql, params
}
