package caching

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
)

var (
	ErrCachingNotAvailable = errors.New("query caching is not available in OSS Grafana")
)

type CacheQueryResponseFn func(context.Context, *backend.QueryDataResponse)
type CacheResourceResponseFn func(context.Context, *backend.CallResourceResponse)
type CacheStatus int

const (
	StatusNotFound      CacheStatus = iota + 1 // No cached data found for query
	StatusCacheHit                             // Cached data found for query
	StatusCacheError                           // Error occurred while processing query or checking cache
	StatusDisabled                             // Caching is implemented but disabled via config or licensing
	StatusUnimplemented                        // Caching is not implemented
)

type CachedQueryDataResponse struct {
	// The cached data response associated with a query, or nil if no cached data is found
	Response *backend.QueryDataResponse
	// A function that should be used to cache a QueryDataResponse for a given query - can be set to nil by the method implementation
	UpdateCacheFn CacheQueryResponseFn
	Status        CacheStatus
}

type CachedResourceDataResponse struct {
	// The cached resource response associated with a request, or nil if no cached data is found
	Response *backend.CallResourceResponse
	// A function that should be used to cache a CallResourceResponse for a given query - can be set to nil by the method implementation
	UpdateCacheFn CacheResourceResponseFn
	Status        CacheStatus
}

func ProvideCachingService() *OSSCachingService {
	return &OSSCachingService{}
}

type CachingService interface {
	HandleQueryRequest(context.Context, dtos.MetricRequest) CachedQueryDataResponse
	HandleResourceRequest(context.Context, *http.Request) CachedResourceDataResponse
}

// Implementation of interface
type OSSCachingService struct {
}

func (s *OSSCachingService) HandleQueryRequest(ctx context.Context, req dtos.MetricRequest) CachedQueryDataResponse {
	return CachedQueryDataResponse{
		Status: StatusUnimplemented,
	}
}

func (s *OSSCachingService) HandleResourceRequest(ctx context.Context, req *http.Request) CachedResourceDataResponse {
	return CachedResourceDataResponse{
		Status: StatusUnimplemented,
	}
}

var _ CachingService = &OSSCachingService{}
