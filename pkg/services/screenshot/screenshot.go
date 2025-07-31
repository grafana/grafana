package screenshot

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"path"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	namespace = "grafana"
	subsystem = "screenshot"
)

var ErrScreenshotsUnavailable = errors.New("screenshots unavailable")

// Screenshot represents a path to a screenshot on disk.
type Screenshot struct {
	Path string
}

type screenshotFunc func(ctx context.Context, opts ScreenshotOptions) (*Screenshot, error)

// ScreenshotService is an interface for taking screenshots.
//
//go:generate mockgen -destination=screenshot_mock.go -package=screenshot github.com/grafana/grafana/pkg/services/screenshot ScreenshotService
type ScreenshotService interface {
	Take(ctx context.Context, opts ScreenshotOptions) (*Screenshot, error)
}

// HeadlessScreenshotService takes screenshots using a headless browser.
type HeadlessScreenshotService struct {
	cfg *setting.Cfg
	ds  dashboards.DashboardService
	rs  rendering.Service

	duration  prometheus.Histogram
	failures  *prometheus.CounterVec
	successes prometheus.Counter
}

func NewHeadlessScreenshotService(cfg *setting.Cfg, ds dashboards.DashboardService, rs rendering.Service, r prometheus.Registerer) ScreenshotService {
	return &HeadlessScreenshotService{
		cfg: cfg,
		ds:  ds,
		rs:  rs,
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

// Take returns a screenshot of the panel. It returns an error if either the panel,
// or the dashboard that contains the panel, does not exist, or the screenshot could not be
// taken due to an error. It uses both the context and the timeout in ScreenshotOptions,
// however the same context is used for both database queries and the request to the
// rendering service, while the timeout in ScreenshotOptions is passed to the rendering service
// where it is used as a client timeout. It is not recommended to pass a context without a deadline
// and the context deadline should be at least as long as the timeout in ScreenshotOptions.
func (s *HeadlessScreenshotService) Take(ctx context.Context, opts ScreenshotOptions) (*Screenshot, error) {
	start := time.Now()
	defer func() { s.duration.Observe(time.Since(start).Seconds()) }()

	q := dashboards.GetDashboardQuery{OrgID: opts.OrgID, UID: opts.DashboardUID}
	dashboard, err := s.ds.GetDashboard(ctx, &q)
	if err != nil {
		s.instrumentError(err)
		return nil, err
	}

	opts = opts.SetDefaults()

	u := url.URL{}
	u.Path = path.Join("d-solo", dashboard.UID, dashboard.Slug)
	p := u.Query()
	p.Add("orgId", strconv.FormatInt(dashboard.OrgID, 10))
	p.Add("panelId", strconv.FormatInt(opts.PanelID, 10))
	if opts.From != "" && opts.To != "" {
		p.Add("from", opts.From)
		p.Add("to", opts.To)
	}
	u.RawQuery = p.Encode()

	renderOpts := rendering.Opts{
		CommonOpts: rendering.CommonOpts{
			AuthOpts: rendering.AuthOpts{
				OrgID:   dashboard.OrgID,
				OrgRole: org.RoleAdmin,
			},
			TimeoutOpts: rendering.TimeoutOpts{
				Timeout: opts.Timeout,
			},
			ConcurrentLimit: s.cfg.RendererConcurrentRequestLimit,
			Path:            u.String(),
		},
		ErrorOpts: rendering.ErrorOpts{
			ErrorConcurrentLimitReached: true,
			ErrorRenderUnavailable:      true,
		},
		Width:  opts.Width,
		Height: opts.Height,
		Theme:  opts.Theme,
	}

	result, err := s.rs.Render(ctx, rendering.RenderPNG, renderOpts, nil)
	if err != nil {
		s.instrumentError(err)
		return nil, fmt.Errorf("failed to take screenshot: %w", err)
	}

	s.successes.Inc()
	screenshot := Screenshot{Path: result.FilePath}
	return &screenshot, nil
}

func (s *HeadlessScreenshotService) instrumentError(err error) {
	if errors.Is(err, dashboards.ErrDashboardNotFound) {
		s.failures.With(prometheus.Labels{
			"reason": "dashboard_not_found",
		}).Inc()
	} else if errors.Is(err, context.Canceled) {
		s.failures.With(prometheus.Labels{
			"reason": "context_canceled",
		}).Inc()
	} else {
		s.failures.With(prometheus.Labels{
			"reason": "error",
		}).Inc()
	}
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
