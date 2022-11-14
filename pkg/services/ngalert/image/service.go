package image

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/screenshot"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	screenshotCacheTTL = 60 * time.Second
	screenshotTimeout  = 10 * time.Second
)

var (
	// ErrNoDashboard is returned when the alert rule does not have a Dashboard UID
	// in its annotations or the dashboard does not exist.
	ErrNoDashboard = errors.New("no dashboard")

	// ErrNoPanel is returned when the alert rule does not have a PanelID in its
	// annotations.
	ErrNoPanel = errors.New("no panel")
)

// DeleteExpiredService is a service to delete expired images.
type DeleteExpiredService struct {
	store store.ImageAdminStore
}

func (s *DeleteExpiredService) DeleteExpired(ctx context.Context) (int64, error) {
	return s.store.DeleteExpiredImages(ctx)
}

func ProvideDeleteExpiredService(store *store.DBstore) *DeleteExpiredService {
	return &DeleteExpiredService{store: store}
}

//go:generate mockgen -destination=mock.go -package=image github.com/grafana/grafana/pkg/services/ngalert/image ImageService
type ImageService interface {
	// NewImage returns a new image for the alert instance.
	NewImage(ctx context.Context, r *models.AlertRule) (*models.Image, error)
}

// ScreenshotImageService takes screenshots of the alert rule and saves the
// image in the store. The image contains a unique token that can be passed
// as an annotation or label to the Alertmanager. This service cannot take
// screenshots of alert rules that are not associated with a dashboard panel.
type ScreenshotImageService struct {
	cache        CacheService
	limiter      screenshot.RateLimiter
	logger       log.Logger
	screenshots  screenshot.ScreenshotService
	singleflight singleflight.Group
	store        store.ImageStore
	uploads      *UploadingService
}

// NewScreenshotImageService returns a new ScreenshotImageService.
func NewScreenshotImageService(
	cache CacheService,
	limiter screenshot.RateLimiter,
	logger log.Logger,
	screenshots screenshot.ScreenshotService,
	store store.ImageStore,
	uploads *UploadingService) ImageService {
	return &ScreenshotImageService{
		cache:       cache,
		limiter:     limiter,
		logger:      logger,
		screenshots: screenshots,
		store:       store,
		uploads:     uploads,
	}
}

// NewScreenshotImageServiceFromCfg returns a new ScreenshotImageService
// from the configuration.
func NewScreenshotImageServiceFromCfg(cfg *setting.Cfg, db *store.DBstore, ds dashboards.DashboardService,
	rs rendering.Service, r prometheus.Registerer) (ImageService, error) {
	var (
		cache       CacheService                 = &NoOpCacheService{}
		limiter     screenshot.RateLimiter       = &screenshot.NoOpRateLimiter{}
		screenshots screenshot.ScreenshotService = &screenshot.ScreenshotUnavailableService{}
		uploads     *UploadingService            = nil
	)

	// If screenshots are enabled
	if cfg.UnifiedAlerting.Screenshots.Capture {
		cache = NewInmemCacheService(screenshotCacheTTL, r)
		limiter = screenshot.NewTokenRateLimiter(cfg.UnifiedAlerting.Screenshots.MaxConcurrentScreenshots)
		screenshots = screenshot.NewHeadlessScreenshotService(ds, rs, r)

		// Image uploading is an optional feature
		if cfg.UnifiedAlerting.Screenshots.UploadExternalImageStorage {
			m, err := imguploader.NewImageUploader()
			if err != nil {
				return nil, fmt.Errorf("failed to initialize uploading screenshot service: %w", err)
			}
			uploads = NewUploadingService(m, r)
		}
	}

	return NewScreenshotImageService(cache, limiter, log.New("ngalert.image"), screenshots, db, uploads), nil
}

// NewImage returns a screenshot of the alert rule or an error.
//
// The alert rule must be associated with a dashboard panel for a screenshot to be
// taken. If the alert rule does not have a Dashboard UID in its annotations,
// or the dashboard does not exist, an ErrNoDashboard error is returned. If the
// alert rule has a Dashboard UID and the dashboard exists, but does not have a
// Panel ID in its annotations then an ErrNoPanel error is returned.
func (s *ScreenshotImageService) NewImage(ctx context.Context, r *models.AlertRule) (*models.Image, error) {
	logger := s.logger.FromContext(ctx)

	dashboardUID := r.GetDashboardUID()
	if dashboardUID == "" {
		logger.Debug("Cannot take screenshot for alert rule as it is not associated with a dashboard")
		return nil, ErrNoDashboard
	}

	panelID := r.GetPanelID()
	if panelID <= 0 {
		logger.Debug("Cannot take screenshot for alert rule as it is not associated with a panel")
		return nil, ErrNoPanel
	}

	logger = logger.New("dashboard", dashboardUID, "panel", panelID)

	opts := screenshot.ScreenshotOptions{
		DashboardUID: dashboardUID,
		PanelID:      panelID,
		Timeout:      screenshotTimeout,
	}

	logger = logger.New("dashboard", opts.DashboardUID, "panel", opts.PanelID)

	// To prevent concurrent screenshots of the same dashboard panel we use singleflight,
	// deduplicated on a base64 hash of the screenshot options.
	optsHash := base64.StdEncoding.EncodeToString(opts.Hash())

	// If there is an image is in the cache return it instead of taking another screenshot
	if image, ok := s.cache.Get(ctx, optsHash); ok {
		logger.Debug("Found cached image", "token", image.Token)
		return &image, nil
	}

	// We create both a context with timeout and set a timeout in ScreenshotOptions. The timeout
	// in the context is used for both database queries and the request to the rendering service,
	// while the timeout in ScreenshotOptions is passed to the rendering service where it is used as
	// a client timeout. It is not recommended to pass a context without a deadline and the context
	// deadline should be at least as long as the timeout in ScreenshotOptions.
	ctx, cancelFunc := context.WithTimeout(ctx, screenshotTimeout)
	defer cancelFunc()

	logger.Debug("Requesting screenshot")

	result, err, _ := s.singleflight.Do(optsHash, func() (interface{}, error) {
		// Once deduplicated concurrent screenshots are then rate-limited
		screenshot, err := s.limiter.Do(ctx, opts, s.screenshots.Take)
		if err != nil {
			if errors.Is(err, dashboards.ErrDashboardNotFound) {
				return nil, ErrNoDashboard
			}
			return nil, err
		}

		logger.Debug("Took screenshot", "path", screenshot.Path)
		image := models.Image{Path: screenshot.Path}

		// Uploading images is optional
		if s.uploads != nil {
			if image, err = s.uploads.Upload(ctx, image); err != nil {
				logger.Warn("Failed to upload image", "error", err)
			} else {
				logger.Debug("Uploaded image", "url", image.URL)
			}
		}

		if err := s.store.SaveImage(ctx, &image); err != nil {
			return nil, fmt.Errorf("failed to save image: %w", err)
		}
		logger.Debug("Saved image", "token", image.Token)

		return image, nil
	})
	if err != nil {
		return nil, err
	}

	image := result.(models.Image)
	if err = s.cache.Set(ctx, optsHash, image); err != nil {
		s.logger.Warn("Failed to cache image",
			"token", image.Token,
			"error", err)
	}

	return &image, nil
}

// NotAvailableImageService is a service that returns ErrScreenshotsUnavailable.
type NotAvailableImageService struct{}

func (s *NotAvailableImageService) NewImage(_ context.Context, _ *models.AlertRule) (*models.Image, error) {
	return nil, screenshot.ErrScreenshotsUnavailable
}

// NoopImageService is a no-op image service.
type NoopImageService struct{}

func (s *NoopImageService) NewImage(_ context.Context, _ *models.AlertRule) (*models.Image, error) {
	return &models.Image{}, nil
}
