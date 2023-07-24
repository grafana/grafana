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
type CacheResourceResponseFn func(context.Context, *backend.CallResourceResponse)

type CachedQueryDataResponse struct {
	// The cached data response associated with a query, or nil if no cached data is found
	Response *backend.QueryDataResponse
	// A function that should be used to cache a QueryDataResponse for a given query.
	// It can be set to nil by the method implementation (if there is an error, for example), so it should be checked before being called.
	UpdateCacheFn CacheQueryResponseFn
}

type CachedResourceDataResponse struct {
	// The cached response associated with a resource request, or nil if no cached data is found
	Response *backend.CallResourceResponse
	// A function that should be used to cache a CallResourceResponse for a given resource request.
	// It can be set to nil by the method implementation (if there is an error, for example), so it should be checked before being called.
	// Because plugins can send multiple responses asynchronously, the implementation should be able to handle multiple calls to this function for one request.
	UpdateCacheFn CacheResourceResponseFn
}

func ProvideCachingService() *OSSCachingService {
	return &OSSCachingService{}
}

type CachingService interface {
	// HandleQueryRequest uses a QueryDataRequest to check the cache for any existing results for that query.
	// If none are found, it should return false and a CachedQueryDataResponse with an UpdateCacheFn which can be used to update the results cache after the fact.
	// This function may populate any response headers (accessible through the context) with the cache status using the X-Cache header.
	HandleQueryRequest(context.Context, *backend.QueryDataRequest) (bool, CachedQueryDataResponse)
	// HandleResourceRequest uses a CallResourceRequest to check the cache for any existing results for that request. If none are found, it should return false.
	// This function may populate any response headers (accessible through the context) with the cache status using the X-Cache header.
	HandleResourceRequest(context.Context, *backend.CallResourceRequest) (bool, CachedResourceDataResponse)
}

// Implementation of interface - does nothing
type OSSCachingService struct {
}

func (s *OSSCachingService) HandleQueryRequest(ctx context.Context, req *backend.QueryDataRequest) (bool, CachedQueryDataResponse) {
	return false, CachedQueryDataResponse{}
}

func (s *OSSCachingService) HandleResourceRequest(ctx context.Context, req *backend.CallResourceRequest) (bool, CachedResourceDataResponse) {
	return false, CachedResourceDataResponse{}
}

var _ CachingService = &OSSCachingService{}
