package db

import (
	"bytes"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func NewSqlBuilder(cfg *setting.Cfg, dialect migrator.Dialect) SQLBuilder {
	return SQLBuilder{cfg: cfg, dialect: dialect}
}

type SQLBuilder struct {
	cfg     *setting.Cfg
	sql     bytes.Buffer
	params  []interface{}
	dialect migrator.Dialect
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

func (sb *SQLBuilder) WriteDashboardPermissionFilter(user *user.SignedInUser, permission dashboards.PermissionType) {
	var (
		sql    string
		params []interface{}
	)
	if !ac.IsDisabled(sb.cfg) {
		sql, params = permissions.NewAccessControlDashboardPermissionFilter(user, permission, "").Where()
	} else {
		sql, params = permissions.DashboardPermissionFilter{
			OrgRole:         user.OrgRole,
			Dialect:         sb.dialect,
			UserId:          user.UserID,
			OrgId:           user.OrgID,
			PermissionLevel: permission,
		}.Where()
	}

	sb.sql.WriteString(" AND " + sql)
	sb.params = append(sb.params, params...)
}
