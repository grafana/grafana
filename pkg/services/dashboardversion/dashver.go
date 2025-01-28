package dashver

import (
	"context"
)

type Service interface {
	Get(context.Context, *GetDashboardVersionQuery) (*DashboardVersionDTO, error)
	DeleteExpired(context.Context, *DeleteExpiredVersionsCommand) error
	List(context.Context, *ListDashboardVersionsQuery) (*DashboardVersionResponse, error)
}
