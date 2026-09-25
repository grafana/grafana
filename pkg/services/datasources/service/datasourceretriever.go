package service

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// DataSourceRetrieverImpl implements DataSourceRetriever by delegating to a Store.
type DataSourceRetrieverImpl struct {
	store          Store
	pluginRegistry registry.Service
}

var _ DataSourceRetriever = (*DataSourceRetrieverImpl)(nil)

// ProvideDataSourceRetriever creates a DataSourceRetriever for wire injection.
func ProvideDataSourceRetriever(db db.DB, features featuremgmt.FeatureToggles, pluginRegistry registry.Service) DataSourceRetriever {
	dslogger := log.New("datasources-retriever")
	store := &SqlStore{db: db, logger: dslogger, features: features}
	return &DataSourceRetrieverImpl{store: store, pluginRegistry: pluginRegistry}
}

// GetDataSource gets a datasource.
func (r *DataSourceRetrieverImpl) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	return r.store.GetDataSource(ctx, query)
}

// GetDataSourceInNamespace gets a datasource by namespace, name (datasource uid), and type.
// If query.AliasIDs is nil, it's resolved against r.pluginRegistry first, so a caller can pass
// either a plugin's canonical ID or one of its legacy aliases (e.g. "postgres" or
// "grafana-postgresql-datasource") and match a datasource stored under either.
func (r *DataSourceRetrieverImpl) GetDataSourceInNamespace(ctx context.Context, query *datasources.GetDataSourceInNamespaceQuery) (*datasources.DataSource, error) {
	if query.AliasIDs == nil {
		query.AliasIDs = ResolveAliasIDs(ctx, r.pluginRegistry, query.Type)
	}
	return r.store.GetDataSourceInNamespace(ctx, query)
}
