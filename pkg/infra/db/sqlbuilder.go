package db

import (
	"bytes"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func NewSqlBuilder(cfg *setting.Cfg, features featuremgmt.FeatureToggles, dialect migrator.Dialect, recursiveQueriesAreSupported bool) SQLBuilder {
	return SQLBuilder{cfg: cfg, features: features, dialect: dialect, recursiveQueriesAreSupported: recursiveQueriesAreSupported}
}

type SQLBuilder struct {
	cfg                          *setting.Cfg
	features                     featuremgmt.FeatureToggles
	sql                          bytes.Buffer
	params                       []interface{}
	recQry                       string
	recQryParams                 []interface{}
	recursiveQueriesAreSupported bool

	dialect migrator.Dialect
}

func (sb *SQLBuilder) Write(sql string, params ...interface{}) {
	sb.sql.WriteString(sql)

	if len(params) > 0 {
		sb.params = append(sb.params, params...)
	}
}

func (sb *SQLBuilder) GetSQLString() string {
	if sb.recQry == "" {
		return sb.sql.String()
	}

	var bf bytes.Buffer
	bf.WriteString(sb.recQry)
	bf.WriteString(sb.sql.String())
	return bf.String()
}

func (sb *SQLBuilder) GetParams() []interface{} {
	if len(sb.recQryParams) == 0 {
		return sb.params
	}

	sb.params = append(sb.recQryParams, sb.params...)
	return sb.params
}

func (sb *SQLBuilder) AddParams(params ...interface{}) {
	sb.params = append(sb.params, params...)
}

func (sb *SQLBuilder) WriteDashboardPermissionFilter(user *user.SignedInUser, permission dashboards.PermissionType, queryType string) {
	var (
		sql          string
		params       []interface{}
		recQry       string
		recQryParams []interface{}
	)
	if !ac.IsDisabled(sb.cfg) {
		filterRBAC := permissions.NewAccessControlDashboardPermissionFilter(user, permission, queryType, sb.features, sb.recursiveQueriesAreSupported)
		sql, params = filterRBAC.Where()
		recQry, recQryParams = filterRBAC.With()
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
	sb.recQry = recQry
	sb.recQryParams = recQryParams
}
