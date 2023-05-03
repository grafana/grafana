package starimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/star"
)

type store interface {
	Get(context.Context, *star.IsStarredByUserQuery) (bool, error)
	Insert(context.Context, *star.StarDashboardCommand) error
	Delete(context.Context, *star.UnstarDashboardCommand) error
	DeleteByUser(context.Context, int64) error
	List(context.Context, *star.GetUserStarsQuery) (*star.GetUserStarsResult, error)
}
