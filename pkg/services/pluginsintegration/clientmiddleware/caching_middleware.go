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

// NewUserHeaderMiddleware creates a new plugins.ClientMiddleware that will
// populate the X-Grafana-User header on outgoing plugins.Client requests.
func NewCachingMiddleware(cachingService caching.CachingService) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		log := log.New("caching_middleware")
		if err := prometheus.Register(QueryRequestHistogram); err != nil {
			log.Error("error registering prometheus collector", "error", err)
		}
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

func (m *CachingMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	start := time.Now() // time how long this request takes
	reqCtx := contexthandler.FromContext(ctx)

	// First look in the query cache if enabled
	cr := m.caching.HandleQueryRequest(ctx, req)
	// Immediately write any headers to the response
	cr.WriteHeadersToResponse(&reqCtx.Resp)

	if isCacheHit(cr.Headers) {
		return cr.Response, nil
	}

	// do the actual queries
	resp, err := m.next.QueryData(ctx, req)

	// Update the query cache with the result for this metrics request
	if err == nil && cr.UpdateCacheFn != nil {
		cr.UpdateCacheFn(ctx, resp)
	}
	// record request duration if caching was used
	if h, ok := cr.Headers[caching.XCacheHeader]; ok && len(h) > 0 {
		QueryRequestHistogram.With(prometheus.Labels{
			"datasource_type": req.PluginContext.DataSourceInstanceSettings.Type,
			"cache":           cr.Headers[caching.XCacheHeader][0],
			"query_type":      getQueryType(reqCtx),
		}).Observe(time.Since(start).Seconds())
	}

	return resp, err
}

func (m *CachingMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	return m.next.CallResource(ctx, req, sender)
}

func isCacheHit(headers map[string][]string) bool {
	if headers == nil {
		return false
	}

	if v, ok := headers[caching.XCacheHeader]; ok {
		return len(v) > 0 && v[0] == caching.StatusHit
	}
	return false
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
