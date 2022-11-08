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
	screenshotTimeout  = 10 * time.Second
	screenshotCacheTTL = 60 * time.Second
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
	limiter      screenshot.RateLimiter
	logger       log.Logger
	screenshots  screenshot.ScreenshotService
	singleflight singleflight.Group
	store        store.ImageStore
	uploads      *UploadingService
}

// NewScreenshotImageService returns a new ScreenshotImageService.
func NewScreenshotImageService(
	limiter screenshot.RateLimiter,
	logger log.Logger,
	screenshots screenshot.ScreenshotService,
	store store.ImageStore,
	uploads *UploadingService) ImageService {
	return &ScreenshotImageService{
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
		limiter     screenshot.RateLimiter       = &screenshot.NoOpRateLimiter{}
		screenshots screenshot.ScreenshotService = &screenshot.ScreenshotUnavailableService{}
		uploads     *UploadingService            = nil
	)

	// If screenshots are enabled
	if cfg.UnifiedAlerting.Screenshots.Capture {
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

	return NewScreenshotImageService(limiter, cfg.Logger, screenshots, db, uploads), nil
}

// NewImage returns a screenshot of the alert rule or an error.
//
// The alert rule must be associated with a dashboard panel for a screenshot to be
// taken. If the alert rule does not have a Dashboard UID in its annotations,
// or the dashboard does not exist, an ErrNoDashboard error is returned. If the
// alert rule has a Dashboard UID and the dashboard exists, but does not have a
// Panel ID in its annotations then an ErrNoPanel error is returned.
func (s *ScreenshotImageService) NewImage(ctx context.Context, r *models.AlertRule) (*models.Image, error) {
	if r.DashboardUID == nil {
		return nil, ErrNoDashboard
	}

	if r.PanelID == nil || *r.PanelID == 0 {
		return nil, ErrNoPanel
	}

	ctx, cancelFunc := context.WithTimeout(ctx, screenshotTimeout)
	defer cancelFunc()

	opts := screenshot.ScreenshotOptions{
		DashboardUID: *r.DashboardUID,
		PanelID:      *r.PanelID,
		Timeout:      screenshotTimeout,
	}

	k := base64.StdEncoding.EncodeToString(opts.Sum())
	result, err, _ := s.singleflight.Do(k, func() (interface{}, error) {
		screenshot, err := s.limiter.Do(ctx, opts, s.screenshots.Take)
		if err != nil {
			if errors.Is(err, dashboards.ErrDashboardNotFound) {
				return nil, ErrNoDashboard
			}
			return nil, err
		}
		image := models.Image{Path: screenshot.Path}
		if s.uploads != nil {
			if image, err = s.uploads.Upload(ctx, image); err != nil {
				s.logger.Warn("failed to upload image", "path", image.Path, "error", err)
			}
		}
		if err := s.store.SaveImage(ctx, &image); err != nil {
			return nil, fmt.Errorf("failed to save image: %w", err)
		}
		return image, nil
	})
	if err != nil {
		return nil, err
	}

	image := result.(models.Image)
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
