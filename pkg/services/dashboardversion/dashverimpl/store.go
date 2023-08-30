package dashverimpl

import (
	"context"

	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
)

type store interface {
	Get(context.Context, *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error)
	GetBatch(context.Context, *dashver.DeleteExpiredVersionsCommand, int, int) ([]any, error)
	DeleteBatch(context.Context, *dashver.DeleteExpiredVersionsCommand, []any) (int64, error)
	List(context.Context, *dashver.ListDashboardVersionsQuery) ([]*dashver.DashboardVersion, error)
}
