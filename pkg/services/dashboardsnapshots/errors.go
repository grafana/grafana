package dashboardsnapshots

import "github.com/grafana/grafana/pkg/services/dashboards"

var ErrDashboardSnapshotNotFound = dashboards.DashboardErr{
	Reason:     "Dashboard snapshot not found",
	StatusCode: 404,
}
