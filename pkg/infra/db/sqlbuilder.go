package db

import (
	"bytes"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/setting"
)

func NewSqlBuilder(cfg *setting.Cfg, features featuremgmt.FeatureToggles, dialect migrator.Dialect, recursiveQueriesAreSupported bool) SQLBuilder {
	return SQLBuilder{cfg: cfg, features: features, dialect: dialect, recursiveQueriesAreSupported: recursiveQueriesAreSupported}
}

type SQLBuilder struct {
	cfg                          *setting.Cfg
	features                     featuremgmt.FeatureToggles
	sql                          bytes.Buffer
	params                       []any
	leftJoin                     string
	recQry                       string
	recQryParams                 []any
	recursiveQueriesAreSupported bool

	dialect migrator.Dialect
}

func (sb *SQLBuilder) Write(sql string, params ...any) {
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
	if sb.leftJoin != "" {
		bf.WriteString(" LEFT OUTER JOIN " + sb.leftJoin)
	}
	return bf.String()
}

func (sb *SQLBuilder) GetParams() []any {
	if len(sb.recQryParams) == 0 {
		return sb.params
	}

	sb.params = append(sb.recQryParams, sb.params...)
	return sb.params
}

func (sb *SQLBuilder) AddParams(params ...any) {
	sb.params = append(sb.params, params...)
}

func (sb *SQLBuilder) WriteDashboardPermissionFilter(user identity.Requester, permission dashboardaccess.PermissionType, queryType string) {
	var (
		sql          string
		params       []any
		recQry       string
		recQryParams []any
		leftJoin     string
	)

	filterRBAC := permissions.NewAccessControlDashboardPermissionFilter(user, permission, queryType, sb.features, sb.recursiveQueriesAreSupported, sb.dialect)
	leftJoin = filterRBAC.LeftJoin()
	sql, params = filterRBAC.Where()
	recQry, recQryParams = filterRBAC.With()

	sb.sql.WriteString(" AND " + sql)
	sb.params = append(sb.params, params...)
	sb.recQry = recQry
	sb.recQryParams = recQryParams
	sb.leftJoin = leftJoin
}
