package caching

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	ErrCachingNotAvailable = errors.New("query caching is not available in OSS Grafana")
)

func ProvideCachingService() *OSSCachingService {
	return &OSSCachingService{}
}

type CachingService interface {
	CacheQueryResponse(context.Context, *backend.QueryDataResponse) error
	CacheResourceResponse(context.Context, *backend.QueryDataResponse) error
	HandleQueryRequest(context.Context) (*backend.QueryDataResponse, error)
	HandleResourceRequest(context.Context) (*backend.QueryDataResponse, error)
}

type OSSCachingService struct {
}

func (s *OSSCachingService) HandleQueryRequest(ctx context.Context) (*backend.QueryDataResponse, error) {
	return nil, ErrCachingNotAvailable
}

func (s *OSSCachingService) HandleResourceRequest(ctx context.Context) (*backend.QueryDataResponse, error) {
	return nil, ErrCachingNotAvailable
}

func (s *OSSCachingService) CacheQueryResponse(ctx context.Context, resp *backend.QueryDataResponse) error {
	return ErrCachingNotAvailable
}

func (s *OSSCachingService) CacheResourceResponse(ctx context.Context, resp *backend.QueryDataResponse) error {
	return ErrCachingNotAvailable
}

var _ CachingService = &OSSCachingService{}
