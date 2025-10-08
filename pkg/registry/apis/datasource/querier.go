package datasource

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type QuerierFactoryFunc func(ctx context.Context, ri utils.ResourceInfo, pj plugins.JSONData) (Querier, error)

type QuerierProvider interface {
	Querier(ctx context.Context, ri utils.ResourceInfo, pj plugins.JSONData) (Querier, error)
}

type DefaultQuerierProvider struct {
	factory QuerierFactoryFunc
}

func ProvideDefaultQuerierProvider(pluginClient plugins.Client, dsService datasources.DataSourceService,
	dsCache datasources.CacheService) *DefaultQuerierProvider {
	return NewQuerierProvider(func(ctx context.Context, ri utils.ResourceInfo, pj plugins.JSONData) (Querier, error) {
		return NewDefaultQuerier(ri, pj, pluginClient, dsService, dsCache), nil
	})
}

func NewQuerierProvider(factory QuerierFactoryFunc) *DefaultQuerierProvider {
	return &DefaultQuerierProvider{
		factory: factory,
	}
}

func (p *DefaultQuerierProvider) Querier(ctx context.Context, ri utils.ResourceInfo, pj plugins.JSONData) (Querier, error) {
	return p.factory(ctx, ri, pj)
}

// Querier is the interface that wraps the Query method.
type Querier interface {
	// Query runs the query on behalf of the user in context.
	Query(ctx context.Context, query *backend.QueryDataRequest) (*backend.QueryDataResponse, error)
	// Health checks the health of the plugin.
	Health(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error)
	// Resource gets a resource plugin.
	Resource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error
}

type DefaultQuerier struct {
	connectionResourceInfo utils.ResourceInfo
	pluginJSON             plugins.JSONData
	pluginClient           plugins.Client
	dsService              datasources.DataSourceService
	dsCache                datasources.CacheService
}

func NewDefaultQuerier(
	connectionResourceInfo utils.ResourceInfo,
	pluginJSON plugins.JSONData,
	pluginClient plugins.Client,
	dsService datasources.DataSourceService,
	dsCache datasources.CacheService,
) *DefaultQuerier {
	return &DefaultQuerier{
		connectionResourceInfo: connectionResourceInfo,
		pluginJSON:             pluginJSON,
		pluginClient:           pluginClient,
		dsService:              dsService,
		dsCache:                dsCache,
	}
}

func (q *DefaultQuerier) Query(ctx context.Context, query *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	_, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	return q.pluginClient.QueryData(ctx, query)
}

func (q *DefaultQuerier) Resource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	_, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return err
	}
	return q.pluginClient.CallResource(ctx, req, sender)
}

func (q *DefaultQuerier) Health(ctx context.Context, query *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	_, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	return q.pluginClient.CheckHealth(ctx, query)
}
