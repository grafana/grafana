package store

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
)

// Store is the database abstraction for migration persistence.
type Store interface {
	ReadStore
}

// ReadStore is the database abstraction for read-only migration persistence.
type ReadStore interface {
	GetDatasource(ctx context.Context, datasourceID int64, user identity.Requester) (*datasources.DataSource, error)
	GetDashboard(ctx context.Context, orgID int64, id int64) (*dashboards.Dashboard, error)
	CaseInsensitive() bool
}

type migrationStore struct {
	store            db.DB
	cfg              *setting.Cfg
	log              log.Logger
	dashboardService dashboards.DashboardService
	dataSourceCache  datasources.CacheService
}

// MigrationStore implements the Store interface.
var _ Store = (*migrationStore)(nil)

func ProvideMigrationStore(
	cfg *setting.Cfg,
	sqlStore db.DB,
	dashboardService dashboards.DashboardService,
	dataSourceCache datasources.CacheService,
) (Store, error) {
	return &migrationStore{
		log:              log.New("ngalert.migration-store"),
		cfg:              cfg,
		store:            sqlStore,
		dashboardService: dashboardService,
		dataSourceCache:  dataSourceCache,
	}, nil
}

// GetDashboard returns a single dashboard for the given org and dashboard id.
func (ms *migrationStore) GetDashboard(ctx context.Context, orgID int64, id int64) (*dashboards.Dashboard, error) {
	return ms.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{ID: id, OrgID: orgID})
}

// GetDatasource returns a single datasource for the given org and datasource id.
func (ms *migrationStore) GetDatasource(ctx context.Context, datasourceID int64, user identity.Requester) (*datasources.DataSource, error) {
	return ms.dataSourceCache.GetDatasource(ctx, datasourceID, user, false)
}

func (ms *migrationStore) CaseInsensitive() bool {
	return ms.store.GetDialect().SupportEngine()
}
