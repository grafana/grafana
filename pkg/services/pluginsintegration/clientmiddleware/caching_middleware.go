package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/services/caching"
	"github.com/grafana/grafana/pkg/services/contexthandler"
)

// NewCachingMiddleware creates a new backend.HandlerMiddleware that will
// attempt to read and write query results to the cache
func NewCachingMiddleware(cachingServiceClient *caching.CachingServiceClient) backend.HandlerMiddleware {
	cachingMiddlewareHandler := func(next backend.Handler) backend.Handler {
		return &CachingMiddleware{
			BaseHandler:          backend.NewBaseHandler(next),
			cachingServiceClient: cachingServiceClient,
		}
	}

	return backend.HandlerMiddlewareFunc(cachingMiddlewareHandler)
}

// An adapter to use CachingServiceClient as a middleware. If possible prefer to use `CachingServiceClient` directly.
type CachingMiddleware struct {
	backend.BaseHandler

	cachingServiceClient *caching.CachingServiceClient
}

// QueryData receives a data request and attempts to access results already stored in the cache for that request.
// If data is found, it will return it immediately. Otherwise, it will perform the queries as usual, then write the response to the cache.
// If the cache service is implemented, we capture the request duration as a metric. The service is expected to write any response headers.
func (m *CachingMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}
	return m.cachingServiceClient.WithQueryDataCaching(ctx, req, func() (*backend.QueryDataResponse, error) {
		return m.BaseHandler.QueryData(ctx, req)
	})
}

// CallResource receives a resource request and attempts to access results already stored in the cache for that request.
// If data is found, it will return it immediately. Otherwise, it will perform the request as usual. The caller of CallResource is expected to explicitly update the cache with any responses.
// If the cache service is implemented, we capture the request duration as a metric. The service is expected to write any response headers.
func (m *CachingMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}

	return m.cachingServiceClient.WithCallResourceCaching(ctx, req, sender, func(sender backend.CallResourceResponseSender) error {
		return m.BaseHandler.CallResource(ctx, req, sender)
	})
}
