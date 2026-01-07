package service

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// DataSourceRetrieverImpl implements DataSourceRetriever by delegating to a Store.
type DataSourceRetrieverImpl struct {
	store Store
}

// ProvideDataSourceRetriever creates a DataSourceRetriever for wire injection.
func ProvideDataSourceRetriever(db db.DB, features featuremgmt.FeatureToggles) DataSourceRetriever {
	dslogger := log.New("datasources-retriever")
	store := &SqlStore{db: db, logger: dslogger, features: features}
	return &DataSourceRetrieverImpl{store: store}
}

// GetDataSource gets a datasource.
func (r *DataSourceRetrieverImpl) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	return r.store.GetDataSource(ctx, query)
}

// GetDataSourceInNamespace gets a datasource by namespace, name (datasource uid), and group (datasource type).
func (r *DataSourceRetrieverImpl) GetDataSourceInNamespace(ctx context.Context, namespace, name, group string) (*datasources.DataSource, error) {
	return r.store.GetDataSourceInNamespace(ctx, namespace, name, group)
}
