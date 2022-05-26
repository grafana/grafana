package dashver

import (
	"context"
)

type Service interface {
	Get(ctx context.Context, query *GetDashboardVersionQuery) (*DashboardVersion, error)
}
