package screenshot

import (
	"context"
	"encoding/base64"
	"time"

	gocache "github.com/patrickmn/go-cache"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// CacheService caches screenshots.
//
//go:generate mockgen -destination=cache_mock.go -package=screenshot github.com/grafana/grafana/pkg/services/screenshot CacheService
type CacheService interface {
	// Get returns the screenshot for the options or false if a screenshot with these
	// options does not exist.
	Get(ctx context.Context, opts ScreenshotOptions) (*Screenshot, bool)
	// Set the screenshot for the options. If another screenshot exists with these
	// options then it will be replaced.
	Set(ctx context.Context, opts ScreenshotOptions, screenshot *Screenshot) error
}

// InmemCacheService is an in-mem screenshot cache.
type InmemCacheService struct {
	cache       *gocache.Cache
	cacheHits   prometheus.Counter
	cacheMisses prometheus.Counter
}

func NewInmemCacheService(expiration time.Duration, r prometheus.Registerer) CacheService {
	return &InmemCacheService{
		cache: gocache.New(expiration, time.Minute),
		cacheHits: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Name:      "cache_hits_total",
			Namespace: namespace,
			Subsystem: subsystem,
		}),
		cacheMisses: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Name:      "cache_misses_total",
			Namespace: namespace,
			Subsystem: subsystem,
		}),
	}
}

func (s *InmemCacheService) Get(_ context.Context, opts ScreenshotOptions) (*Screenshot, bool) {
	k := base64.StdEncoding.EncodeToString(opts.Hash())
	if v, ok := s.cache.Get(k); ok {
		defer s.cacheHits.Inc()
		return v.(*Screenshot), true
	}
	defer s.cacheMisses.Inc()
	return nil, false
}

func (s *InmemCacheService) Set(_ context.Context, opts ScreenshotOptions, screenshot *Screenshot) error {
	k := base64.StdEncoding.EncodeToString(opts.Hash())
	s.cache.Set(k, screenshot, 0)
	return nil
}

type NoOpCacheService struct{}

func (s *NoOpCacheService) Get(_ context.Context, _ ScreenshotOptions) (*Screenshot, bool) {
	return nil, false
}

func (s *NoOpCacheService) Set(_ context.Context, _ ScreenshotOptions, _ *Screenshot) error {
	return nil
}
