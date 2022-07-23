package dashver

import (
	"context"
)

type Service interface {
	Get(context.Context, *GetDashboardVersionQuery) (*DashboardVersion, error)
	DeleteExpired(context.Context, *DeleteExpiredVersionsCommand) error
	List(context.Context, *ListDashboardVersionsQuery) ([]*DashboardVersionDTO, error)
}
