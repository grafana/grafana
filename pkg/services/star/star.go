package star

import (
	"context"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

type StoreService interface {
	Add(context.Context, *StarDashboardCommand) error
	Delete(context.Context, *UnstarDashboardCommand) error
	DeleteByUser(context.Context, int64) error
	IsStarredByUser(context.Context, *IsStarredByUserQuery) (bool, error)
	GetByUser(context.Context, *GetUserStarsQuery) (*GetUserStarsResult, error)
}

type HTTPService interface {
	GetStars(c *models.ReqContext) response.Response
	StarDashboard(c *models.ReqContext) response.Response
	UnstarDashboard(c *models.ReqContext) response.Response
}
