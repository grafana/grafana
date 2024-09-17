package star

import (
	"context"
)

type Service interface {
	Add(context.Context, *StarDashboardCommand) error
	Delete(context.Context, *UnstarDashboardCommand) error
	DeleteByUser(context.Context, int64) error
	IsStarredByUser(context.Context, *IsStarredByUserQuery) (bool, error)
	GetByUser(context.Context, *GetUserStarsQuery) (*GetUserStarsResult, error)
}
