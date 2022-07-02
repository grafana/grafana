package star

import (
	"context"
)

type Service interface {
	Add(ctx context.Context, cmd *StarDashboardCommand) error
	Delete(ctx context.Context, cmd *UnstarDashboardCommand) error
	IsStarredByUser(ctx context.Context, query *IsStarredByUserQuery) (bool, error)
	GetByUser(ctx context.Context, cmd *GetUserStarsQuery) (*GetUserStarsResult, error)
}
