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
	CreateQueryInQueryHistory(ctx context.Context, user *models.SignedInUser, cmd CreateQueryInQueryHistoryCommand) error
}

type QueryHistoryService struct {
	SQLStore      *sqlstore.SQLStore
	Cfg           *setting.Cfg
	RouteRegister routing.RouteRegister
	log           log.Logger
}

func (s QueryHistoryService) CreateQueryInQueryHistory(ctx context.Context, user *models.SignedInUser, cmd CreateQueryInQueryHistoryCommand) error {
	return s.createQuery(ctx, user, cmd)
}
