package image

import (
	"context"
	"time"

	gocache "github.com/patrickmn/go-cache"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	namespace = "grafana"
	subsystem = "alerting"
)

// CacheService caches images.
//
//go:generate mockgen -destination=cache_mock.go -package=image github.com/grafana/grafana/pkg/services/ngalert/image CacheService
type CacheService interface {
	// Get returns the screenshot for the options or false if a screenshot with these
	// options does not exist.
	Get(ctx context.Context, k string) (models.Image, bool)
	// Set the screenshot for the options. If another screenshot exists with these
	// options then it will be replaced.
	Set(ctx context.Context, k string, image models.Image) error
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
			Name:      "image_cache_hits_total",
			Namespace: namespace,
			Subsystem: subsystem,
		}),
		cacheMisses: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Name:      "image_cache_misses_total",
			Namespace: namespace,
			Subsystem: subsystem,
		}),
	}
}

func (s *InmemCacheService) Get(_ context.Context, k string) (models.Image, bool) {
	if v, ok := s.cache.Get(k); ok {
		defer s.cacheHits.Inc()
		return v.(models.Image), true
	}
	defer s.cacheMisses.Inc()
	return models.Image{}, false
}

func (s *InmemCacheService) Set(_ context.Context, k string, screenshot models.Image) error {
	s.cache.Set(k, screenshot, 0)
	return nil
}

type NoOpCacheService struct{}

func (s *NoOpCacheService) Get(_ context.Context, _ string) (models.Image, bool) {
	return models.Image{}, false
}

func (s *NoOpCacheService) Set(_ context.Context, _ string, _ models.Image) error {
	return nil
}
