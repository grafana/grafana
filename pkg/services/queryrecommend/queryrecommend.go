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
	GetQueryRecommendation(ctx context.Context, datasource string, query string) (QueryRecommendResponse, error)
	ComputeQueryRecommendation(ctx context.Context, datasource string) error
	// CreateQueryInQueryHistory(ctx context.Context, user *user.SignedInUser, cmd CreateQueryInQueryHistoryCommand) (QueryHistoryDTO, error)
	// SearchInQueryHistory(ctx context.Context, user *user.SignedInUser, query SearchInQueryHistoryQuery) (QueryHistorySearchResult, error)
	// DeleteQueryFromQueryHistory(ctx context.Context, user *user.SignedInUser, UID string) (int64, error)
	// PatchQueryCommentInQueryHistory(ctx context.Context, user *user.SignedInUser, UID string, cmd PatchQueryCommentInQueryHistoryCommand) (QueryHistoryDTO, error)
	// StarQueryInQueryHistory(ctx context.Context, user *user.SignedInUser, UID string) (QueryHistoryDTO, error)
	// UnstarQueryInQueryHistory(ctx context.Context, user *user.SignedInUser, UID string) (QueryHistoryDTO, error)
	// DeleteStaleQueriesInQueryHistory(ctx context.Context, olderThan int64) (int, error)
	// EnforceRowLimitInQueryHistory(ctx context.Context, limit int, starredQueries bool) (int, error)
}

type QueryRecommendService struct {
	store         db.DB
	Cfg           *setting.Cfg
	RouteRegister routing.RouteRegister
	log           log.Logger
	now           func() time.Time
}

func (s QueryRecommendService) GetQueryRecommendation(ctx context.Context, datasource string, metric string) ([]QueryRecommendDTO, error) {
	return s.getQueryRecommendation(ctx, datasource, metric)
}

func (s QueryRecommendService) ComputeQueryRecommendation(ctx context.Context, datasource string) error {
	return s.computeQueryRecommendation(ctx, datasource)
}
