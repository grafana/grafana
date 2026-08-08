package service

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

// DataSourceRetrieverImpl implements DataSourceRetriever by delegating to a Store.
// pluginStore is optional and late-bound via BindPluginStore when wire cannot inject
// it at construction time (enterprise: pluginstore depends on accesscontrol RoleRegistry).
type DataSourceRetrieverImpl struct {
	store       Store
	pluginStore pluginstore.Store
}

var _ DataSourceRetriever = (*DataSourceRetrieverImpl)(nil)

// ProvideDataSourceRetriever creates a DataSourceRetriever for wire injection.
func ProvideDataSourceRetriever(db db.DB, features featuremgmt.FeatureToggles) DataSourceRetriever {
	dslogger := log.New("datasources-retriever")
	store := &SqlStore{db: db, logger: dslogger, features: features}
	return &DataSourceRetrieverImpl{store: store}
}

// BindPluginStore attaches the plugin store so GetDataSource* can canonicalize alias
// plugin IDs. Safe after construction; must run before serving traffic that depends on
// canonical types. r must be the *DataSourceRetrieverImpl from ProvideDataSourceRetriever.
func BindPluginStore(r DataSourceRetriever, pluginStore pluginstore.Store) {
	impl, ok := r.(*DataSourceRetrieverImpl)
	if !ok || impl == nil {
		return
	}
	impl.pluginStore = pluginStore
}

// CanonicalType resolves typeOrAlias to the canonical plugin ID using the bound store.
func (r *DataSourceRetrieverImpl) CanonicalType(ctx context.Context, typeOrAlias string) string {
	return datasources.CanonicalPluginType(ctx, r.pluginStore, typeOrAlias)
}

// GetDataSource gets a datasource and rewrites Type to the canonical plugin ID when possible.
func (r *DataSourceRetrieverImpl) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	ds, err := r.store.GetDataSource(ctx, query)
	if err != nil {
		return nil, err
	}
	if ds == nil {
		// SqlStore never returns (nil, nil); guard fakes / alternate stores before Type rewrite.
		return nil, datasources.ErrDataSourceNotFound
	}
	ds.Type = r.CanonicalType(ctx, ds.Type)
	return ds, nil
}

// GetDataSourceInNamespace gets a datasource by namespace, name (datasource uid), and group
// (datasource type). Type is rewritten to the canonical plugin ID when possible.
func (r *DataSourceRetrieverImpl) GetDataSourceInNamespace(ctx context.Context, namespace, name, group string) (*datasources.DataSource, error) {
	ds, err := r.store.GetDataSourceInNamespace(ctx, namespace, name, group)
	if err != nil {
		return nil, err
	}
	if ds == nil {
		return nil, datasources.ErrDataSourceNotFound
	}
	ds.Type = r.CanonicalType(ctx, ds.Type)
	return ds, nil
}
