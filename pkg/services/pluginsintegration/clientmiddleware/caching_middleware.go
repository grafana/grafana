package clientmiddleware

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/caching"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/prometheus/client_golang/prometheus"
)

// NewCachingMiddleware creates a new plugins.ClientMiddleware that will
// attempt to read and write query results to the cache
func NewCachingMiddleware(cachingService caching.CachingService) plugins.ClientMiddleware {
	log := log.New("caching_middleware")
	if err := prometheus.Register(QueryCachingRequestHistogram); err != nil {
		log.Error("error registering prometheus collector 'QueryRequestHistogram'", "error", err)
	}
	if err := prometheus.Register(ResourceCachingRequestHistogram); err != nil {
		log.Error("error registering prometheus collector 'ResourceRequestHistogram'", "error", err)
	}
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &CachingMiddleware{
			next:    next,
			caching: cachingService,
			log:     log,
		}
	})
}

type CachingMiddleware struct {
	next    plugins.Client
	caching caching.CachingService
	log     log.Logger
}

// QueryData receives a data request and attempts to access results already stored in the cache for that request.
// If data is found, it will return it immediately. Otherwise, it will perform the queries as usual, then write the response to the cache.
// If the cache service is implemented, we capture the request duration as a metric. The service is expected to write any response headers.
func (m *CachingMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return m.next.QueryData(ctx, req)
	}

	// time how long this request takes
	start := time.Now()

	// First look in the query cache if enabled
	hit, cr := m.caching.HandleQueryRequest(ctx, req)

	defer func() {
		// record request duration if caching was used
		if ch := reqCtx.Resp.Header().Get(caching.XCacheHeader); ch != "" {
			QueryCachingRequestHistogram.With(prometheus.Labels{
				"datasource_type": req.PluginContext.DataSourceInstanceSettings.Type,
				"cache":           ch,
				"query_type":      getQueryType(reqCtx),
			}).Observe(time.Since(start).Seconds())
		}
	}()

	// Cache hit; return the response
	if hit {
		return cr.Response, nil
	}

	// Cache miss; do the actual queries
	resp, err := m.next.QueryData(ctx, req)

	// Update the query cache with the result for this metrics request
	if err == nil && cr.UpdateCacheFn != nil {
		cr.UpdateCacheFn(ctx, resp)
	}

	return resp, err
}

// CallResource receives a resource request and attempts to access results already stored in the cache for that request.
// If data is found, it will return it immediately. Otherwise, it will perform the request as usual. The caller of CallResource is expected to explicitly update the cache with any responses.
// If the cache service is implemented, we capture the request duration as a metric. The service is expected to write any response headers.
func (m *CachingMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	// time how long this request takes
	start := time.Now()

	// First look in the resource cache if enabled
	hit, resp := m.caching.HandleResourceRequest(ctx, req)

	defer func() {
		// record request duration if caching was used
		if ch := reqCtx.Resp.Header().Get(caching.XCacheHeader); ch != "" {
			ResourceCachingRequestHistogram.With(prometheus.Labels{
				"plugin_id": req.PluginContext.PluginID,
				"cache":     ch,
			}).Observe(time.Since(start).Seconds())
		}
	}()

	// Cache hit; send the response and return
	if hit {
		return sender.Send(resp)
	}

	// Cache miss; do the actual request
	// The call to update the cache happens in /pkg/api/plugin_resource.go in the flushStream() func
	// TODO: Implement updating the cache from this method
	return m.next.CallResource(ctx, req, sender)
}

func (m *CachingMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return m.next.CheckHealth(ctx, req)
}

func (m *CachingMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *CachingMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *CachingMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *CachingMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}
