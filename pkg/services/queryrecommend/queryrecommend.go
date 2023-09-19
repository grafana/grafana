package queryrecommend

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlStore db.DB, routeRegister routing.RouteRegister) *QueryRecommendService {
	s := &QueryRecommendService{
		store:         sqlStore,
		Cfg:           cfg,
		RouteRegister: routeRegister,
		log:           log.New("query-recommend"),
		now:           time.Now,
	}

	s.registerAPIEndpoints()

	return s
}

type Service interface {
	GetQueryRecommendation(ctx context.Context, datasource string, metric string, numSuggestions int64) ([]QueryRecommendDTO, error)
	ComputeQueryRecommendation(ctx context.Context, datasource string) error
}

type QueryRecommendService struct {
	store         db.DB
	Cfg           *setting.Cfg
	RouteRegister routing.RouteRegister
	log           log.Logger
	now           func() time.Time
}

func (s QueryRecommendService) GetQueryRecommendation(ctx context.Context, datasource string, metric string, numSuggestions int64) ([]QueryRecommendDTO, error) {
	return s.getQueryRecommendation(ctx, datasource, metric, numSuggestions)
}

func (s QueryRecommendService) ComputeQueryRecommendation(ctx context.Context, datasource string) error {
	return s.computeQueryRecommendation(ctx, datasource)
}
