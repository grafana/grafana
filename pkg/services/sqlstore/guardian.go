package sqlstore

import (
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetAllowedDashboards)
}

func GetAllowedDashboards(query *m.GetAllowedDashboardsQuery) error {

	rawSQL := `select distinct d.id as DashboardId
from dashboard as d
	left join dashboard as df on d.parent_id = df.id
	left join dashboard_acl as dfa on d.parent_id = dfa.dashboard_id or d.id = dfa.dashboard_id
	left join user_group_member as ugm on ugm.user_group_id =  dfa.user_group_id
where (
  (d.has_acl = 1 and (dfa.user_id = ? or ugm.user_id = ? or df.created_by = ? or (d.is_folder = 1 and d.created_by = ?)))
  or d.has_acl = 0)
  and d.org_id = ?`

	res, err := x.Query(rawSQL, query.UserId, query.UserId, query.UserId, query.UserId, query.OrgId)
	if err != nil {
		return err
	}

	query.Result = make([]int64, 0)
	for _, dash := range res {
		id, err := strconv.ParseInt(string(dash["DashboardId"]), 10, 64)
		if err != nil {
			return err
		}
		query.Result = append(query.Result, id)
	}

	return nil
}
