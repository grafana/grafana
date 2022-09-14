package screenshot

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	namespace = "grafana"
	subsystem = "screenshot"
)

var (
	ErrScreenshotsUnavailable = errors.New("screenshots unavailable")
)

// Screenshot represents a path to a screenshot on disk.
type Screenshot struct {
	Path string
}

// ScreenshotService is an interface for taking screenshots.
//
//go:generate mockgen -destination=mock.go -package=screenshot github.com/grafana/grafana/pkg/services/screenshot ScreenshotService
type ScreenshotService interface {
	Take(ctx context.Context, opts ScreenshotOptions) (*Screenshot, error)
}

// ManagedScreenshotService is a managed screenshot service that features caching,
// single-flight, rate-limiting and instrumentation. It is the recommended service
// to use unless screenshots are disabled, in which case either NoOpScreenshotService
// or UnavilableScreenshotService are recommended.
type ManagedScreenshotService struct {
	cache        CacheService
	capture      CaptureService
	singleFlight SingleFlight
	tokens       TokenBucket

	duration  prometheus.Histogram
	failures  *prometheus.CounterVec
	successes prometheus.Counter
}

func NewManagedScreenshotService(cs CaptureService, sf SingleFlight, tb TokenBucket, ch CacheService, r prometheus.Registerer) ScreenshotService {
	return &ManagedScreenshotService{
		cache:        ch,
		capture:      cs,
		singleFlight: sf,
		tokens:       tb,

		duration: promauto.With(r).NewHistogram(prometheus.HistogramOpts{
			Name:      "duration_seconds",
			Buckets:   []float64{0.1, 0.25, 0.5, 1, 2, 5, 10, 15},
			Namespace: namespace,
			Subsystem: subsystem,
		}),
		failures: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Name:      "failures_total",
			Namespace: namespace,
			Subsystem: subsystem,
		}, []string{"reason"}),
		successes: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Name:      "successes_total",
			Namespace: namespace,
			Subsystem: subsystem,
		}),
	}
}

func (s *ManagedScreenshotService) Take(ctx context.Context, opts ScreenshotOptions) (*Screenshot, error) {
	start := time.Now()
	defer func() { s.duration.Observe(time.Since(start).Seconds()) }()

	// If a screenshot with these options has been taken before then return it
	if screenshot, ok := s.cache.Get(ctx, opts); ok {
		return screenshot, nil
	}

	// Get a token from the bucket to prevent large numbers of concurrent screenshots
	if ok, err := s.tokens.Get(ctx); err != nil {
		return nil, err
	} else if ok {
		defer s.tokens.Done()
	} else {
		return nil, errors.New("expected token but no token available")
	}

	screenshot, err := s.singleFlight.Do(ctx, opts, s.capture.Screenshot)
	if err != nil {
		if errors.Is(err, dashboards.ErrDashboardNotFound) {
			defer s.failures.With(prometheus.Labels{
				"reason": "dashboard_not_found",
			}).Inc()
		} else if errors.Is(err, context.Canceled) {
			defer s.failures.With(prometheus.Labels{
				"reason": "context_canceled",
			}).Inc()
		} else {
			defer s.failures.With(prometheus.Labels{
				"reason": "error",
			}).Inc()
		}
		return nil, err
	}

	if err = s.cache.Set(ctx, opts, screenshot); err != nil {
		return nil, err
	}

	defer s.successes.Inc()
	return screenshot, nil
}

// NoOpScreenshotService is a service that takes no-op screenshots.
type NoOpScreenshotService struct{}

func (s *NoOpScreenshotService) Take(_ context.Context, _ ScreenshotOptions) (*Screenshot, error) {
	return &Screenshot{}, nil
}

// ScreenshotUnavailableService is a service that returns ErrScreenshotsUnavailable.
type ScreenshotUnavailableService struct{}

func (s *ScreenshotUnavailableService) Take(_ context.Context, _ ScreenshotOptions) (*Screenshot, error) {
	return nil, ErrScreenshotsUnavailable
}
