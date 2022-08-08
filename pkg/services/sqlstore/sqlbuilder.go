package sqlstore

import (
	"bytes"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
)

type SQLBuilder struct {
	sql    bytes.Buffer
	params []interface{}
}

func (sb *SQLBuilder) Write(sql string, params ...interface{}) {
	sb.sql.WriteString(sql)

	if len(params) > 0 {
		sb.params = append(sb.params, params...)
	}
}

func (sb *SQLBuilder) GetSQLString() string {
	return sb.sql.String()
}

func (sb *SQLBuilder) GetParams() []interface{} {
	return sb.params
}

func (sb *SQLBuilder) AddParams(params ...interface{}) {
	sb.params = append(sb.params, params...)
}

func (sb *SQLBuilder) WriteDashboardPermissionFilter(user *models.SignedInUser, permission models.PermissionType) {
	filter := permissions.DashboardPermissionFilter{
		OrgRole:         user.OrgRole,
		Dialect:         dialect,
		UserId:          user.UserId,
		OrgId:           user.OrgId,
		PermissionLevel: permission,
	}

	sql, params := filter.Where()
	sb.sql.WriteString(" AND" + sql)
	sb.params = append(sb.params, params...)
}
