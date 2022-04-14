package queryhistory

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore, routeRegister routing.RouteRegister) *QueryHistoryService {
	s := &QueryHistoryService{
		SQLStore:      sqlStore,
		Cfg:           cfg,
		RouteRegister: routeRegister,
		log:           log.New("query-history"),
	}

	// Register routes only when query history is enabled
	if s.Cfg.QueryHistoryEnabled {
		s.registerAPIEndpoints()
	}

	return s
}

type Service interface {
	CreateQueryInQueryHistory(ctx context.Context, user *models.SignedInUser, cmd CreateQueryInQueryHistoryCommand) (QueryHistoryDTO, error)
	SearchInQueryHistory(ctx context.Context, user *models.SignedInUser, query SearchInQueryHistoryQuery) (QueryHistorySearchResult, error)
	DeleteQueryFromQueryHistory(ctx context.Context, user *models.SignedInUser, UID string) (int64, error)
	PatchQueryCommentInQueryHistory(ctx context.Context, user *models.SignedInUser, UID string, cmd PatchQueryCommentInQueryHistoryCommand) (QueryHistoryDTO, error)
	StarQueryInQueryHistory(ctx context.Context, user *models.SignedInUser, UID string) (QueryHistoryDTO, error)
	UnstarQueryInQueryHistory(ctx context.Context, user *models.SignedInUser, UID string) (QueryHistoryDTO, error)
}

type QueryHistoryService struct {
	SQLStore      *sqlstore.SQLStore
	Cfg           *setting.Cfg
	RouteRegister routing.RouteRegister
	log           log.Logger
}

func (s QueryHistoryService) CreateQueryInQueryHistory(ctx context.Context, user *models.SignedInUser, cmd CreateQueryInQueryHistoryCommand) (QueryHistoryDTO, error) {
	return s.createQuery(ctx, user, cmd)
}

func (s QueryHistoryService) SearchInQueryHistory(ctx context.Context, user *models.SignedInUser, query SearchInQueryHistoryQuery) (QueryHistorySearchResult, error) {
	return s.searchQueries(ctx, user, query)
}

func (s QueryHistoryService) DeleteQueryFromQueryHistory(ctx context.Context, user *models.SignedInUser, UID string) (int64, error) {
	return s.deleteQuery(ctx, user, UID)
}

func (s QueryHistoryService) PatchQueryCommentInQueryHistory(ctx context.Context, user *models.SignedInUser, UID string, cmd PatchQueryCommentInQueryHistoryCommand) (QueryHistoryDTO, error) {
	return s.patchQueryComment(ctx, user, UID, cmd)
}

func (s QueryHistoryService) StarQueryInQueryHistory(ctx context.Context, user *models.SignedInUser, UID string) (QueryHistoryDTO, error) {
	return s.starQuery(ctx, user, UID)
}

func (s QueryHistoryService) UnstarQueryInQueryHistory(ctx context.Context, user *models.SignedInUser, UID string) (QueryHistoryDTO, error) {
	return s.unstarQuery(ctx, user, UID)
}
