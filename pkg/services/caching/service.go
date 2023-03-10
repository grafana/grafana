package caching

import (
	"context"
	"errors"
)

var (
	ErrCachingNotAvailable = errors.New("query caching is not available in OSS Grafana")
)

func ProvideCachingService() *OSSCachingService {
	return &OSSCachingService{}
}

type CachingService interface {
	HandleRequest(context.Context) error
}

type OSSCachingService struct {
}

func (s *OSSCachingService) HandleRequest(ctx context.Context) error {
	return ErrCachingNotAvailable
}

var _ CachingService = &OSSCachingService{}
