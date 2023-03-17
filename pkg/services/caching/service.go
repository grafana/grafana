package caching

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
)

var (
	ErrCachingNotAvailable = errors.New("query caching is not available in OSS Grafana")
)

type CacheResponseFn func(context.Context, *backend.QueryDataResponse)
type CacheStatus int

const (
	StatusNotFound      CacheStatus = iota + 1 // No cached data found for query
	StatusCacheHit                             // Cached data found for query
	StatusCacheError                           // Error occurred while processing query or checking cache
	StatusDisabled                             // Caching is implemented but disabled via config or licensing
	StatusUnimplemented                        // Caching is not implemented
)

type CachedDataResponse struct {
	// The cached data response associated with a query, or nil if no cached data is found
	Response *backend.QueryDataResponse
	// A function that should be used to cache a QueryDataResponse for a given query - can be set to nil by the method implementation
	UpdateCacheFn CacheResponseFn
	Status        CacheStatus
}

func ProvideCachingService() *OSSCachingService {
	return &OSSCachingService{}
}

type CachingService interface {
	HandleQueryRequest(context.Context, dtos.MetricRequest) CachedDataResponse
	HandleResourceRequest(context.Context) (*backend.QueryDataResponse, bool, CacheResponseFn, error)
}

// Implementation of interface
type OSSCachingService struct {
}

func (s *OSSCachingService) HandleQueryRequest(ctx context.Context, req dtos.MetricRequest) CachedDataResponse {
	return CachedDataResponse{
		Status: StatusUnimplemented,
	}
}

func (s *OSSCachingService) HandleResourceRequest(ctx context.Context) (*backend.QueryDataResponse, bool, CacheResponseFn, error) {
	return nil, false, nil, ErrCachingNotAvailable
}

var _ CachingService = &OSSCachingService{}
