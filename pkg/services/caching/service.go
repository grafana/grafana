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
type CacheStatus int

type CachedQueryDataResponse struct {
	// The cached data response associated with a query, or nil if no cached data is found
	Response *backend.QueryDataResponse
	// A function that should be used to cache a QueryDataResponse for a given query - can be set to nil by the method implementation
	UpdateCacheFn CacheQueryResponseFn
}

func ProvideCachingService() *OSSCachingService {
	return &OSSCachingService{}
}

type CachingService interface {
	HandleQueryRequest(context.Context, *backend.QueryDataRequest) CachedQueryDataResponse
	HandleResourceRequest(context.Context, *backend.CallResourceRequest) *backend.CallResourceResponse
	CacheResourceResponse(context.Context, *backend.CallResourceRequest, *backend.CallResourceResponse)
}

// Implementation of interface
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
