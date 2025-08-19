package datasource

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

// This provides access to settings saved in the database.
// Authorization checks will happen within each function, and the user in ctx will
// limit which namespace/tenant/org we are talking to
type PluginDatasourceProvider interface {
	// Get a single data source (any type)
	GetDataSource(ctx context.Context, uid string) (*datasourceV0.DataSource, error)

	// List all datasources (any type)
	ListDataSources(ctx context.Context) (*datasourceV0.DataSourceList, error)

	// Create a data source
	CreateDataSource(ctx context.Context, ds *datasourceV0.DataSource) (*datasourceV0.DataSource, error)

	// Update a data source
	UpdateDataSource(ctx context.Context, ds *datasourceV0.DataSource) (*datasourceV0.DataSource, error)

	// Delete a data source (any type)
	Delete(ctx context.Context, uid string) error

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
	group, _ := plugins.GetDatasourceGroupNameFromPluginID(pluginJson.ID)
	return &scopedDatasourceProvider{
		plugin:          pluginJson,
		dsService:       q.dsService,
		dsCache:         q.dsCache,
		contextProvider: q.contextProvider,
		converter: &converter{
			mapper: q.converter.mapper,
			dstype: pluginJson.ID,
			group:  group,
		},
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

func (q *scopedDatasourceProvider) GetInstanceSettings(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error) {
	if q.contextProvider == nil {
		return nil, fmt.Errorf("missing contextProvider")
	}
	return q.contextProvider.GetDataSourceInstanceSettings(ctx, uid)
}

// CreateDataSource implements PluginDatasourceProvider.
func (q *scopedDatasourceProvider) CreateDataSource(ctx context.Context, ds *datasourceV0.DataSource) (*datasourceV0.DataSource, error) {
	cmd, err := q.converter.toAddCommand(ds)
	if err != nil {
		return nil, err
	}
	out, err := q.dsService.AddDataSource(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return q.converter.asDataSource(out)
}

// UpdateDataSource implements PluginDatasourceProvider.
func (q *scopedDatasourceProvider) UpdateDataSource(ctx context.Context, ds *datasourceV0.DataSource) (*datasourceV0.DataSource, error) {
	cmd, err := q.converter.toUpdateCommand(ds)
	if err != nil {
		return nil, err
	}
	out, err := q.dsService.UpdateDataSource(ctx, cmd)
	if err != nil {
		return nil, err
	}
	return q.converter.asDataSource(out)
}

// Delete implements PluginDatasourceProvider.
func (q *scopedDatasourceProvider) Delete(ctx context.Context, uid string) error {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	ds, err := q.dsCache.GetDatasourceByUID(ctx, uid, user, false)
	if err != nil {
		return err
	}
	if ds == nil {
		return fmt.Errorf("not found")
	}
	return q.dsService.DeleteDataSource(ctx, &datasources.DeleteDataSourceCommand{
		ID:    ds.ID,
		UID:   ds.UID,
		OrgID: ds.OrgID,
		Name:  ds.Name,
	})
}

// GetDataSource implements PluginDatasourceProvider.
func (q *scopedDatasourceProvider) GetDataSource(ctx context.Context, uid string) (*datasourceV0.DataSource, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	ds, err := q.dsCache.GetDatasourceByUID(ctx, uid, user, false)
	if err != nil {
		return nil, err
	}
	return q.converter.asDataSource(ds)
}

// ListDataSource implements PluginDatasourceProvider.
func (q *scopedDatasourceProvider) ListDataSources(ctx context.Context) (*datasourceV0.DataSourceList, error) {
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
	result := &datasourceV0.DataSourceList{
		Items: []datasourceV0.DataSource{},
	}
	for _, ds := range dss {
		v, _ := q.converter.asDataSource(ds)
		result.Items = append(result.Items, *v)
	}
	return result, nil
}
