package dashver

import (
	"context"

	"github.com/grafana/grafana/pkg/services/dashboards"
)

type Service interface {
	Get(context.Context, *GetDashboardVersionQuery) (*DashboardVersionDTO, error)
	DeleteExpired(context.Context, *DeleteExpiredVersionsCommand) error
	List(context.Context, *ListDashboardVersionsQuery) (*DashboardVersionResponse, error)
	RestoreVersion(context.Context, *RestoreVersionCommand) (*dashboards.Dashboard, error)
}
