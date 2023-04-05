package caching

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const (
	XCacheHeader   = "X-Cache"
	StatusHit      = "HIT"
	StatusMiss     = "MISS"
	StatusBypass   = "BYPASS"
	StatusError    = "ERROR"
	StatusDisabled = "DISABLED"
)

type CacheQueryResponseFn func(context.Context, *backend.QueryDataResponse)

type CachedQueryDataResponse struct {
	// The cached data response associated with a query, or nil if no cached data is found
	Response *backend.QueryDataResponse
	// A function that should be used to cache a QueryDataResponse for a given query - can be set to nil by the method implementation
	UpdateCacheFn CacheQueryResponseFn
}

func ProvideCachingService() *OSSCachingService {
	return &OSSCachingService{}
}

//go:generate mockery --name CachingService --structname FakeOSSCachingService --inpackage --filename caching_service_mock.go
type CachingService interface {
	// HandleQueryRequest uses a QueryDataRequest to check the cache for any existing results for that query.
	// If none are found, it should return a CachedQueryDataResponse with an UpdateCacheFn which can be used to update the results cache after the fact.
	// This function should populate the response headers (accessible through the context) with the cache status using the X-Cache header.
	HandleQueryRequest(context.Context, *backend.QueryDataRequest) CachedQueryDataResponse
	// HandleResourceRequest uses a CallResourceRequest to check the cache for any existing results for that request.
	// This function should populate the response headers (accessible through the context) with the cache status using the X-Cache header.
	HandleResourceRequest(context.Context, *backend.CallResourceRequest) *backend.CallResourceResponse
	// HandleResourceRequest is used to cache resource responses for a resource request.
	// Because plugins can send multiple responses asyncronously, the implementation should be able to handle multiple calls to this function for one request.
	CacheResourceResponse(context.Context, *backend.CallResourceRequest, *backend.CallResourceResponse)
}

// Implementation of interface - does nothing
type OSSCachingService struct {
}

func (s *OSSCachingService) HandleQueryRequest(ctx context.Context, req *backend.QueryDataRequest) CachedQueryDataResponse {
	return CachedQueryDataResponse{}
}

func (s *OSSCachingService) HandleResourceRequest(ctx context.Context, req *backend.CallResourceRequest) *backend.CallResourceResponse {
	return nil
}

func (s *OSSCachingService) CacheResourceResponse(ctx context.Context, req *backend.CallResourceRequest, resp *backend.CallResourceResponse) {
}

var _ CachingService = &OSSCachingService{}
