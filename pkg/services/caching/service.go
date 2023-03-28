package caching

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/web"
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
	Headers       map[string][]string
}

type CachedResourceDataResponse struct {
	// The cached resource response associated with a request, or nil if no cached data is found
	Response *backend.CallResourceResponse
	// A function that should be used to cache a CallResourceResponse for a given query - can be set to nil by the method implementation
	UpdateCacheFn CacheResourceResponseFn
	Headers       map[string][]string
}

func ProvideCachingService() *OSSCachingService {
	return &OSSCachingService{}
}

type CachingService interface {
	HandleQueryRequest(context.Context, *backend.QueryDataRequest) CachedQueryDataResponse
	HandleResourceRequest(context.Context, *backend.CallResourceRequest) CachedResourceDataResponse
}

// Implementation of interface
type OSSCachingService struct {
}

func (s *OSSCachingService) HandleQueryRequest(ctx context.Context, req *backend.QueryDataRequest) CachedQueryDataResponse {
	return CachedQueryDataResponse{}
}

func (s *OSSCachingService) HandleResourceRequest(ctx context.Context, req *backend.CallResourceRequest) CachedResourceDataResponse {
	return CachedResourceDataResponse{}
}

var _ CachingService = &OSSCachingService{}

// Some helper funcs
func (r CachedQueryDataResponse) WriteHeadersToResponse(resp *web.ResponseWriter) {
	headers := r.Headers
	if headers == nil {
		return
	}
	for k, vs := range headers {
		for _, v := range vs {
			(*resp).Header().Add(k, v)
		}
	}
}

func (r CachedResourceDataResponse) WriteHeadersToResponse(resp *web.ResponseWriter) {
	if r.Response == nil {
		return
	}
	headers := r.Response.Headers
	if headers == nil {
		return
	}
	for k, vs := range headers {
		for _, v := range vs {
			(*resp).Header().Add(k, v)
		}
	}
}
