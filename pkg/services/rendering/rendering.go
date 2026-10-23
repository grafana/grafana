package rendering

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
)

var _ Service = (*RenderingService)(nil)

type ImageRendererConfig struct {
	URL       string
	AuthToken string
}

// Config supplies the same rendering pipeline in embedded and standalone services.
type Config struct {
	Renderer     ImageRendererConfig
	Settings     SettingsProvider
	Keys         RenderKeyProvider
	Store        ResultStore
	Client       *http.Client
	UserAgent    UserAgentProvider
	Availability Availability
	Limiter      ConcurrencyLimiter
}

type RenderingService struct {
	log          log.Logger
	settings     SettingsProvider
	keys         RenderKeyProvider
	store        ResultStore
	netClient    *http.Client
	userAgent    UserAgentProvider
	renderer     ImageRendererConfig
	availability Availability
	limiter      ConcurrencyLimiter
}

func NewService(cfg Config) (*RenderingService, error) {
	if cfg.Settings == nil || cfg.Store == nil {
		return nil, errors.New("rendering settings and result store are required")
	}

	if cfg.Client == nil {
		cfg.Client = &http.Client{}
	}

	if cfg.UserAgent == nil {
		cfg.UserAgent = StaticUserAgent("Grafana/")
	}

	if cfg.Availability == nil {
		cfg.Availability = ConfiguredAvailability{}
	}

	if cfg.Limiter == nil {
		cfg.Limiter = NewLocalConcurrencyLimiter()
	}

	return &RenderingService{
		log:          log.New("rendering"),
		settings:     cfg.Settings,
		keys:         cfg.Keys,
		store:        cfg.Store,
		netClient:    cfg.Client,
		userAgent:    cfg.UserAgent,
		renderer:     cfg.Renderer,
		availability: cfg.Availability,
		limiter:      cfg.Limiter,
	}, nil
}

func (rs *RenderingService) Run(ctx context.Context) error {
	return rs.availability.Run(ctx)
}

func (rs *RenderingService) IsAvailable(ctx context.Context) bool {
	return rs.renderer.URL != "" && rs.availability.IsAvailable(ctx)
}

func (rs *RenderingService) Version() string {
	if rs.availability == nil {
		return ""
	}

	return rs.availability.Version()
}

func (rs *RenderingService) Health() error {
	return rs.availability.Health()
}

func (rs *RenderingService) RenderErrorImage(theme models.Theme, err error) (*RenderResult, error) {
	kind := "error"
	if errors.Is(err, ErrTimeout) || errors.Is(err, ErrServerTimeout) {
		kind = "timeout"
	}

	result, err := rs.errorImage(kind, theme, err)
	return (*RenderResult)(result), err
}

func (rs *RenderingService) errorImage(kind string, theme models.Theme, cause error) (*Result, error) {
	if theme == "" {
		theme = models.ThemeDark
	}

	name := fmt.Sprintf("rendering_%s_%s.png", kind, theme)
	if kind == "plugin_not_installed" {
		name = "rendering_plugin_not_installed.png"
	}

	result, err := rs.store.Image(name)
	if errors.Is(err, ErrNoStaticImages) && cause != nil {
		return nil, cause
	}

	return result, err
}

func (rs *RenderingService) Render(ctx context.Context, renderType RenderType, opts Opts) (*RenderResult, error) {
	start := time.Now()
	result, err := rs.render(ctx, renderType, opts)
	saveMetrics(time.Since(start).Milliseconds(), err, renderType)
	return (*RenderResult)(result), err
}

func (rs *RenderingService) RenderCSV(ctx context.Context, opts CSVOpts) (*RenderCSVResult, error) {
	start := time.Now()
	result, err := rs.render(ctx, RenderCSV, Opts{CommonOpts: opts.CommonOpts, ErrorOpts: ErrorOpts{ErrorConcurrentLimitReached: true, ErrorRenderUnavailable: true}})
	saveMetrics(time.Since(start).Milliseconds(), err, RenderCSV)
	return (*RenderCSVResult)(result), err
}

func (rs *RenderingService) render(ctx context.Context, renderType RenderType, opts Opts) (*Result, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	if rs.keys == nil {
		return nil, ErrRenderUnavailable
	}

	settings, err := rs.settings(ctx)
	if err != nil {
		return nil, fmt.Errorf("loading rendering settings: %w", err)
	}

	if rs.renderer.URL == "" || !rs.availability.IsAvailable(ctx) {
		if opts.ErrorRenderUnavailable {
			return nil, ErrRenderUnavailable
		}

		return rs.errorImage("plugin_not_installed", opts.Theme, ErrRenderUnavailable)
	}

	limit := opts.ConcurrentLimit
	if settings.ConcurrentLimit > 0 && (limit <= 0 || settings.ConcurrentLimit < limit) {
		limit = settings.ConcurrentLimit
	}

	release, err := rs.limiter.Acquire(ctx, Tenant{Namespace: settings.TenantID, OrgID: opts.OrgID}, limit)
	if err != nil {
		if !errors.Is(err, ErrConcurrentLimitReached) {
			return nil, err
		}

		if opts.ErrorConcurrentLimitReached {
			return nil, ErrConcurrentLimitReached
		}

		return rs.errorImage("limit", opts.Theme, ErrConcurrentLimitReached)
	}

	metrics.MRenderingQueue.Inc()
	defer func() {
		metrics.MRenderingQueue.Dec()
		release() // Okay to be here, only not nil if err is nil
	}()

	if math.IsInf(opts.DeviceScaleFactor, 0) || math.IsNaN(opts.DeviceScaleFactor) || opts.DeviceScaleFactor == 0 {
		opts.DeviceScaleFactor = 1
	}

	logger := rs.log.FromContext(ctx)
	logger.Info("Rendering", "path", opts.Path, "userID", opts.UserID)
	credentials, err := rs.keys.Get(ctx, opts.AuthOpts)
	if err != nil {
		return nil, err
	}

	defer func() {
		cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		rs.keys.Release(cleanupCtx, credentials)
	}()

	result, err := rs.renderViaHTTP(ctx, settings, renderType, credentials, opts)
	if err != nil {
		logger.Error("Failed to render", "path", opts.Path, "error", err)
		return nil, err
	}

	logger.Debug("Successfully rendered", "path", opts.Path)
	return result, nil
}

func isoTimeOffsetToPosixTz(isoOffset string) string {
	if strings.HasPrefix(isoOffset, "UTC+") {
		return strings.Replace(isoOffset, "UTC+", "UTC-", 1)
	}

	if strings.HasPrefix(isoOffset, "UTC-") {
		return strings.Replace(isoOffset, "UTC-", "UTC+", 1)
	}

	return isoOffset
}

func saveMetrics(elapsedTime int64, err error, renderType RenderType) {
	if err == nil {
		metrics.MRenderingRequestTotal.WithLabelValues("success", string(renderType)).Inc()
		metrics.MRenderingSummary.WithLabelValues("success", string(renderType)).Observe(float64(elapsedTime))
		return
	}

	if errors.Is(err, ErrTimeout) {
		metrics.MRenderingRequestTotal.WithLabelValues("timeout", string(renderType)).Inc()
		metrics.MRenderingSummary.WithLabelValues("timeout", string(renderType)).Observe(float64(elapsedTime))
	} else {
		metrics.MRenderingRequestTotal.WithLabelValues("failure", string(renderType)).Inc()
		metrics.MRenderingSummary.WithLabelValues("failure", string(renderType)).Observe(float64(elapsedTime))
	}
}
