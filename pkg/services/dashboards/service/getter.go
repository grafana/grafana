package service

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
)

// GetterServiceImpl is a very simplified, read-only dashboard service. Only add
// methods which contain no business logic (auth, cfg, other services) This is a
// mini-EntityAPI for bare bones CRUD operations where the caller is responsible
// for everything else.
type GetterServiceImpl struct {
	store db.DB
}

var _ dashboards.GetterService = (*GetterServiceImpl)(nil)

func ProvideGetterService(store db.DB) dashboards.GetterService {
	return &GetterServiceImpl{store: store}
}

func (g *GetterServiceImpl) GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	return database.GetDashboard(ctx, g.store, query)
}

func (g *GetterServiceImpl) GetDashboards(ctx context.Context, query *dashboards.GetDashboardsQuery) ([]*dashboards.Dashboard, error) {
	return database.GetDashboards(ctx, g.store, query)
}
