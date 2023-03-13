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

func ProvideCachingService() *OSSCachingService {
	return &OSSCachingService{}
}

type CachingService interface {
	HandleQueryRequest(context.Context, dtos.MetricRequest) (*backend.QueryDataResponse, bool, CacheResponseFn, error)
	HandleResourceRequest(context.Context) (*backend.QueryDataResponse, bool, CacheResponseFn, error)
}

type CacheResponseFn func(context.Context, *backend.QueryDataResponse)

type OSSCachingService struct {
}

func (s *OSSCachingService) HandleQueryRequest(ctx context.Context, req dtos.MetricRequest) (*backend.QueryDataResponse, bool, CacheResponseFn, error) {
	return nil, false, nil, ErrCachingNotAvailable
}

func (s *OSSCachingService) HandleResourceRequest(ctx context.Context) (*backend.QueryDataResponse, bool, CacheResponseFn, error) {
	return nil, false, nil, ErrCachingNotAvailable
}

var _ CachingService = &OSSCachingService{}
