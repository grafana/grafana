package clientmiddleware

import (
	"context"
	"strconv"
	"time"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/caching"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// needed to mock the function for testing
var shouldCacheQuery = awsds.ShouldCacheQuery

// NewCachingMiddleware creates a new backend.HandlerMiddleware that will
// attempt to read and write query results to the cache
func NewCachingMiddleware(cachingService caching.CachingService) backend.HandlerMiddleware {
	return NewCachingMiddlewareWithFeatureManager(cachingService, nil)
}

// NewCachingMiddlewareWithFeatureManager creates a new backend.HandlerMiddleware that will
// attempt to read and write query results to the cache with a feature manager
func NewCachingMiddlewareWithFeatureManager(cachingService caching.CachingService, features featuremgmt.FeatureToggles) backend.HandlerMiddleware {
	log := log.New("caching_middleware")
	if err := prometheus.Register(QueryCachingRequestHistogram); err != nil {
		log.Error("Error registering prometheus collector 'QueryRequestHistogram'", "error", err)
	}
	if err := prometheus.Register(ResourceCachingRequestHistogram); err != nil {
		log.Error("Error registering prometheus collector 'ResourceRequestHistogram'", "error", err)
	}
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &CachingMiddleware{
			BaseHandler: backend.NewBaseHandler(next),
			caching:     cachingService,
			log:         log,
			features:    features,
		}
	})
}

type CachingMiddleware struct {
	backend.BaseHandler

	caching  caching.CachingService
	log      log.Logger
	features featuremgmt.FeatureToggles
}

// QueryData receives a data request and attempts to access results already stored in the cache for that request.
// If data is found, it will return it immediately. Otherwise, it will perform the queries as usual, then write the response to the cache.
// If the cache service is implemented, we capture the request duration as a metric. The service is expected to write any response headers.
func (m *CachingMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctx, span := tracing.Start(ctx, "PluginClient.CachingMiddleware.QueryData")
	defer span.End()

	if req != nil {
		span.SetAttributes(attribute.String("plugin_id", req.PluginContext.PluginID))
		if ds := req.PluginContext.DataSourceInstanceSettings; ds != nil {
			span.SetAttributes(attribute.String("datasource_type", ds.Type))
		}
	}

	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	// time how long this request takes
	start := time.Now()

	// First look in the query cache if enabled
	hit, cr := m.caching.HandleQueryRequest(ctx, req)

	// record request duration if caching was used
	ch := reqCtx.Resp.Header().Get(caching.XCacheHeader)
	if ch != "" {
		span.SetAttributes(attribute.String("cache", ch))
		defer func() {
			QueryCachingRequestHistogram.With(prometheus.Labels{
				"datasource_type": req.PluginContext.DataSourceInstanceSettings.Type,
				"cache":           ch,
				"query_type":      getQueryType(reqCtx),
			}).Observe(time.Since(start).Seconds())
		}()
	}

	// Cache hit; return the response
	if hit {
		return cr.Response, nil
	}

	// Cache miss; do the actual queries
	resp, err := m.BaseHandler.QueryData(ctx, req)

	// Update the query cache with the result for this metrics request
	if err == nil && cr.UpdateCacheFn != nil {
		// If AWS async caching is not enabled, use the old code path
		if m.features == nil || !m.features.IsEnabled(ctx, featuremgmt.FlagAwsAsyncQueryCaching) {
			cr.UpdateCacheFn(ctx, resp)
		} else {
			// time how long shouldCacheQuery takes
			startShouldCacheQuery := time.Now()
			shouldCache := shouldCacheQuery(resp)
			ShouldCacheQueryHistogram.With(prometheus.Labels{
				"datasource_type": req.PluginContext.DataSourceInstanceSettings.Type,
				"cache":           ch,
				"shouldCache":     strconv.FormatBool(shouldCache),
				"query_type":      getQueryType(reqCtx),
			}).Observe(time.Since(startShouldCacheQuery).Seconds())

			// If AWS async caching is enabled and resp is for a running async query, don't cache it
			if shouldCache {
				cr.UpdateCacheFn(ctx, resp)
			}
		}
	}

	return resp, err
}

// CallResource receives a resource request and attempts to access results already stored in the cache for that request.
// If data is found, it will return it immediately. Otherwise, it will perform the request as usual. The caller of CallResource is expected to explicitly update the cache with any responses.
// If the cache service is implemented, we capture the request duration as a metric. The service is expected to write any response headers.
func (m *CachingMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctx, span := tracing.Start(ctx, "PluginClient.CachingMiddleware.CallResource")
	defer span.End()

	if req != nil {
		span.SetAttributes(attribute.String("plugin_id", req.PluginContext.PluginID))
	}

	if req == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}

	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}

	// time how long this request takes
	start := time.Now()

	// First look in the resource cache if enabled
	hit, cr := m.caching.HandleResourceRequest(ctx, req)

	// record request duration if caching was used
	if ch := reqCtx.Resp.Header().Get(caching.XCacheHeader); ch != "" {
		span.SetAttributes(attribute.String("cache", ch))
		defer func() {
			ResourceCachingRequestHistogram.With(prometheus.Labels{
				"plugin_id": req.PluginContext.PluginID,
				"cache":     ch,
			}).Observe(time.Since(start).Seconds())
		}()
	}

	// Cache hit; send the response and return
	if hit {
		return sender.Send(cr.Response)
	}

	// Cache miss; do the actual request
	// If there is no update cache func, just pass in the original sender
	if cr.UpdateCacheFn == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}
	// Otherwise, intercept the responses in a wrapped sender so we can cache them first
	cacheSender := backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
		cr.UpdateCacheFn(ctx, res)
		return sender.Send(res)
	})

	return m.BaseHandler.CallResource(ctx, req, cacheSender)
}
