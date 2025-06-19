package datasource

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

// This provides access to settings saved in the database.
// Authorization checks will happen within each function, and the user in ctx will
// limit which namespace/tenant/org we are talking to
type PluginDatasourceProvider interface {
	// Get gets a specific datasource (that the user in context can see)
	Get(ctx context.Context, uid string) (*v0alpha1.DataSourceConnection, error)

	// List lists all data sources the user in context can see
	List(ctx context.Context) (*v0alpha1.DataSourceConnectionList, error)

	// Get a single datasurce
	GetDataSource(ctx context.Context, uid string) (*v0alpha1.GenericDataSource, error)

	// List all datasources
	ListDataSource(ctx context.Context) (*v0alpha1.GenericDataSourceList, error)

	// Return settings (decrypted!) for a specific plugin
	// This will require "query" permission for the user in context
	GetInstanceSettings(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error)
}

type ScopedPluginDatasourceProvider interface {
	GetDatasourceProvider(pluginJson plugins.JSONData) PluginDatasourceProvider
}

// PluginContext requires adding system settings (feature flags, etc) to the datasource config
type PluginContextWrapper interface {
	PluginContextForDataSource(ctx context.Context, datasourceSettings *backend.DataSourceInstanceSettings) (backend.PluginContext, error)
}

func ProvideDefaultPluginConfigs(
	dsService datasources.DataSourceService,
	dsCache datasources.CacheService,
	contextProvider *plugincontext.Provider) ScopedPluginDatasourceProvider {
	return &cachingDatasourceProvider{
		dsService:       dsService,
		dsCache:         dsCache,
		contextProvider: contextProvider,
		converter: &converter{
			mapper: types.OrgNamespaceFormatter, // TODO -- from cfg!!!
		},
	}
}

type cachingDatasourceProvider struct {
	dsService       datasources.DataSourceService
	dsCache         datasources.CacheService
	contextProvider *plugincontext.Provider
	converter       *converter
}

func (q *cachingDatasourceProvider) GetDatasourceProvider(pluginJson plugins.JSONData) PluginDatasourceProvider {
	return &scopedDatasourceProvider{
		plugin:          pluginJson,
		dsService:       q.dsService,
		dsCache:         q.dsCache,
		contextProvider: q.contextProvider,
		converter:       q.converter,
	}
}

type scopedDatasourceProvider struct {
	plugin          plugins.JSONData
	dsService       datasources.DataSourceService
	dsCache         datasources.CacheService
	contextProvider *plugincontext.Provider
	converter       *converter
}

var (
	_ PluginDatasourceProvider       = (*scopedDatasourceProvider)(nil)
	_ ScopedPluginDatasourceProvider = (*cachingDatasourceProvider)(nil)
)

func (q *scopedDatasourceProvider) Get(ctx context.Context, uid string) (*v0alpha1.DataSourceConnection, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	ds, err := q.dsCache.GetDatasourceByUID(ctx, uid, user, false)
	if err != nil {
		return nil, err
	}
	return q.converter.asConnection(ds)
}

func (q *scopedDatasourceProvider) List(ctx context.Context) (*v0alpha1.DataSourceConnectionList, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	dss, err := q.dsService.GetDataSourcesByType(ctx, &datasources.GetDataSourcesByTypeQuery{
		OrgID:    info.OrgID,
		Type:     q.plugin.ID,
		AliasIDs: q.plugin.AliasIDs,
	})
	if err != nil {
		return nil, err
	}
	result := &v0alpha1.DataSourceConnectionList{
		Items: []v0alpha1.DataSourceConnection{},
	}
	for _, ds := range dss {
		v, _ := q.converter.asConnection(ds)
		result.Items = append(result.Items, *v)
	}
	return result, nil
}

func (q *scopedDatasourceProvider) GetInstanceSettings(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error) {
	if q.contextProvider == nil {
		return nil, fmt.Errorf("missing contextProvider")
	}
	return q.contextProvider.GetDataSourceInstanceSettings(ctx, uid)
}

// GetDataSource implements PluginDatasourceProvider.
func (q *scopedDatasourceProvider) GetDataSource(ctx context.Context, uid string) (*v0alpha1.GenericDataSource, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	ds, err := q.dsCache.GetDatasourceByUID(ctx, uid, user, false)
	if err != nil {
		return nil, err
	}
	return q.converter.asGenericDataSource(ds)
}

// ListDataSource implements PluginDatasourceProvider.
func (q *scopedDatasourceProvider) ListDataSource(ctx context.Context) (*v0alpha1.GenericDataSourceList, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	dss, err := q.dsService.GetDataSourcesByType(ctx, &datasources.GetDataSourcesByTypeQuery{
		OrgID:    info.OrgID,
		Type:     q.plugin.ID,
		AliasIDs: q.plugin.AliasIDs,
	})
	if err != nil {
		return nil, err
	}
	result := &v0alpha1.GenericDataSourceList{
		Items: []v0alpha1.GenericDataSource{},
	}
	for _, ds := range dss {
		v, _ := q.converter.asGenericDataSource(ds)
		result.Items = append(result.Items, *v)
	}
	return result, nil
}
