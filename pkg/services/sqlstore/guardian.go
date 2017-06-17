package sqlstore

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetAllowedDashboards)
}

func GetAllowedDashboards(query *m.GetAllowedDashboardsQuery) error {
	dashboardIds := arrayToString(query.DashList, ",")

	rawSQL := `select distinct d.id as DashboardId
from dashboard as d
	left join dashboard as df on d.parent_id = df.id
	left join dashboard_acl as dfa on d.parent_id = dfa.dashboard_id or d.id = dfa.dashboard_id
	left join user_group_member as ugm on ugm.user_group_id =  dfa.user_group_id
where (
  (d.has_acl = 1 and (dfa.user_id = ? or ugm.user_id = ?))
  or d.has_acl = 0)
  and d.org_id = ?`

	rawSQL = fmt.Sprintf("%v and d.id in(%v)", rawSQL, dashboardIds)

	query.Result = make([]int64, 0)
	err := x.SQL(rawSQL, query.UserId, query.UserId, query.UserId, query.UserId, query.OrgId).Find(&query.Result)

	if err != nil {
		return err
	}

	return nil
}

func arrayToString(a []int64, delim string) string {
	return strings.Trim(strings.Replace(fmt.Sprint(a), " ", delim, -1), "[]")
}
