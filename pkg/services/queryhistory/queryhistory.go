package queryhistory

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlStore db.DB, routeRegister routing.RouteRegister, accessControl ac.AccessControl) *QueryHistoryService {
	s := &QueryHistoryService{
		store:         sqlStore,
		Cfg:           cfg,
		RouteRegister: routeRegister,
		log:           log.New("query-history"),
		now:           time.Now,
		accessControl: accessControl,
	}

	// Register routes only when query history is enabled
	if s.Cfg.QueryHistoryEnabled {
		s.registerAPIEndpoints()
	}

	return s
}

type Service interface {
	CreateQueryInQueryHistory(ctx context.Context, user *user.SignedInUser, cmd CreateQueryInQueryHistoryCommand) (QueryHistoryDTO, error)
	SearchInQueryHistory(ctx context.Context, user *user.SignedInUser, query SearchInQueryHistoryQuery) (QueryHistorySearchResult, error)
	DeleteQueryFromQueryHistory(ctx context.Context, user *user.SignedInUser, UID string) (int64, error)
	PatchQueryCommentInQueryHistory(ctx context.Context, user *user.SignedInUser, UID string, cmd PatchQueryCommentInQueryHistoryCommand) (QueryHistoryDTO, error)
	StarQueryInQueryHistory(ctx context.Context, user *user.SignedInUser, UID string) (QueryHistoryDTO, error)
	UnstarQueryInQueryHistory(ctx context.Context, user *user.SignedInUser, UID string) (QueryHistoryDTO, error)
	DeleteStaleQueriesInQueryHistory(ctx context.Context, olderThan int64) (int, error)
	EnforceRowLimitInQueryHistory(ctx context.Context, limit int, starredQueries bool) (int, error)
}

type QueryHistoryService struct {
	store         db.DB
	Cfg           *setting.Cfg
	RouteRegister routing.RouteRegister
	log           log.Logger
	now           func() time.Time
	accessControl ac.AccessControl
}

func (s QueryHistoryService) CreateQueryInQueryHistory(ctx context.Context, user *user.SignedInUser, cmd CreateQueryInQueryHistoryCommand) (QueryHistoryDTO, error) {
	return s.createQuery(ctx, user, cmd)
}

func (s QueryHistoryService) SearchInQueryHistory(ctx context.Context, user *user.SignedInUser, query SearchInQueryHistoryQuery) (QueryHistorySearchResult, error) {
	return s.searchQueries(ctx, user, query)
}

func (s QueryHistoryService) DeleteQueryFromQueryHistory(ctx context.Context, user *user.SignedInUser, UID string) (int64, error) {
	return s.deleteQuery(ctx, user, UID)
}

func (s QueryHistoryService) PatchQueryCommentInQueryHistory(ctx context.Context, user *user.SignedInUser, UID string, cmd PatchQueryCommentInQueryHistoryCommand) (QueryHistoryDTO, error) {
	return s.patchQueryComment(ctx, user, UID, cmd)
}

func (s QueryHistoryService) StarQueryInQueryHistory(ctx context.Context, user *user.SignedInUser, UID string) (QueryHistoryDTO, error) {
	return s.starQuery(ctx, user, UID)
}

func (s QueryHistoryService) UnstarQueryInQueryHistory(ctx context.Context, user *user.SignedInUser, UID string) (QueryHistoryDTO, error) {
	return s.unstarQuery(ctx, user, UID)
}

func (s QueryHistoryService) DeleteStaleQueriesInQueryHistory(ctx context.Context, olderThan int64) (int, error) {
	return s.deleteStaleQueries(ctx, olderThan)
}

func (s QueryHistoryService) EnforceRowLimitInQueryHistory(ctx context.Context, limit int, starredQueries bool) (int, error) {
	return s.enforceQueryHistoryRowLimit(ctx, limit, starredQueries)
}
