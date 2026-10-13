package image

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/screenshot"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	screenshotCacheTTL = time.Minute
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

type ImageService interface {
	// NewImage returns an image for the alert instance. In asynchronous mode,
	// the token is available before the screenshot is ready.
	NewImage(ctx context.Context, r *models.AlertRule) (*models.Image, error)
	// Run cancels and waits for background screenshots when ctx is canceled.
	Run(ctx context.Context) error
}

// ScreenshotImageService takes screenshots of the alert rule and saves the
// image in the store. The image contains a unique token that can be passed
// as an annotation or label to the Alertmanager. This service cannot take
// screenshots of alert rules that are not associated with a dashboard panel.
type ScreenshotImageService struct {
	cache             CacheService
	limiter           screenshot.RateLimiter
	logger            log.Logger
	screenshots       screenshot.ScreenshotService
	screenshotTimeout time.Duration
	singleflight      singleflight.Group
	store             store.ImageStore
	uploads           *UploadingService
	backgroundCtx     context.Context
	backgroundCancel  context.CancelFunc
	backgroundMu      sync.Mutex
	backgroundTasks   sync.WaitGroup
}

// NewScreenshotImageService returns a new ScreenshotImageService.
func NewScreenshotImageService(
	cache CacheService,
	limiter screenshot.RateLimiter,
	logger log.Logger,
	screenshots screenshot.ScreenshotService,
	screenshotTimeout time.Duration,
	store store.ImageStore,
	uploads *UploadingService) ImageService {
	backgroundCtx, backgroundCancel := context.WithCancel(context.Background())
	return &ScreenshotImageService{
		cache:             cache,
		limiter:           limiter,
		logger:            logger,
		screenshots:       screenshots,
		screenshotTimeout: screenshotTimeout,
		store:             store,
		uploads:           uploads,
		backgroundCtx:     backgroundCtx,
		backgroundCancel:  backgroundCancel,
	}
}

func (s *ScreenshotImageService) Run(ctx context.Context) error {
	<-ctx.Done()
	s.backgroundMu.Lock()
	s.backgroundCancel()
	s.backgroundMu.Unlock()
	s.backgroundTasks.Wait()
	return nil
}

// NewScreenshotImageServiceFromCfg returns a new ScreenshotImageService
// from the configuration.
func NewScreenshotImageServiceFromCfg(cfg *setting.Cfg, db *store.DBstore, ds dashboards.DashboardService,
	rs rendering.Service, r prometheus.Registerer) (ImageService, error) {
	var (
		cache             CacheService                 = &NoOpCacheService{}
		limiter           screenshot.RateLimiter       = &screenshot.NoOpRateLimiter{}
		screenshots       screenshot.ScreenshotService = &screenshot.ScreenshotUnavailableService{}
		screenshotTimeout time.Duration                = 0
		uploads           *UploadingService            = nil
	)

	// If screenshots are enabled
	if cfg.UnifiedAlerting.Screenshots.Capture {
		cache = NewInmemCacheService(screenshotCacheTTL, r)
		limiter = screenshot.NewTokenRateLimiter(cfg.UnifiedAlerting.Screenshots.MaxConcurrentScreenshots)
		screenshots = screenshot.NewHeadlessScreenshotService(cfg, ds, rs, r)
		screenshotTimeout = cfg.UnifiedAlerting.Screenshots.CaptureTimeout

		// Image uploading is an optional feature
		if cfg.UnifiedAlerting.Screenshots.UploadExternalImageStorage {
			m, err := imguploader.NewImageUploader(cfg)
			if err != nil {
				return nil, fmt.Errorf("failed to initialize uploading screenshot service: %w", err)
			}
			uploads = NewUploadingService(m, r)
		}
	}

	return NewScreenshotImageService(cache, limiter, log.New("ngalert.image"),
		screenshots, screenshotTimeout, db, uploads), nil
}

// NewImage returns a screenshot of the alert rule, a pending image token in
// asynchronous mode, or an error.
//
// The alert rule must have a dashboard UID and panel ID; missing annotations
// return models.ErrNoDashboard or models.ErrNoPanel. A missing dashboard also
// returns models.ErrNoDashboard in synchronous mode. Background capture failures
// are logged because the image token has already been returned.
func (s *ScreenshotImageService) NewImage(ctx context.Context, r *models.AlertRule) (*models.Image, error) {
	async := openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAlertingAsyncImageUpload, false, openfeature.TransactionContext(ctx))
	logger := s.logger.FromContext(ctx)

	dashboardUID := r.GetDashboardUID()
	if dashboardUID == "" {
		logger.Debug("Cannot take screenshot for alert rule as it is not associated with a dashboard")
		return nil, models.ErrNoDashboard
	}

	panelID := r.GetPanelID()
	if panelID <= 0 {
		logger.Debug("Cannot take screenshot for alert rule as it is not associated with a panel")
		return nil, models.ErrNoPanel
	}
	if _, unavailable := s.screenshots.(*screenshot.ScreenshotUnavailableService); unavailable {
		return nil, screenshot.ErrScreenshotsUnavailable
	}

	logger = logger.New("dashboard", dashboardUID, "panel", panelID)

	opts := screenshot.ScreenshotOptions{
		OrgID:        r.OrgID,
		DashboardUID: dashboardUID,
		PanelID:      panelID,
		Timeout:      s.screenshotTimeout,
	}

	// Share cached images across modes, but don't make async callers wait for a synchronous flight.
	optsHash := base64.StdEncoding.EncodeToString(opts.Hash())
	flightKey := optsHash
	if async {
		flightKey += "/async"
	}

	// If there is an image is in the cache return it instead of taking another screenshot
	if image, ok := s.cachedImage(ctx, optsHash); ok {
		logger.Debug("Found cached image", "token", image.Token)
		return imageForCaller(ctx, image, async)
	}

	logger.Debug("Requesting screenshot")

	result, err, _ := s.singleflight.Do(flightKey, func() (any, error) {
		if async {
			// A caller can miss the cache just before another singleflight call finishes.
			if image, ok := s.cachedImage(ctx, optsHash); ok {
				return image, nil
			}
			return s.newAsyncImage(ctx, opts, optsHash)
		}

		image, err := s.captureImage(ctx, opts, models.Image{})
		if err != nil {
			return nil, err
		}
		if err := s.saveImage(ctx, &image); err != nil {
			return nil, err
		}
		return image, nil
	})
	if err != nil {
		return nil, err
	}

	image, err := imageForCaller(ctx, result.(models.Image), async)
	if err != nil {
		return nil, err
	}
	if !async {
		s.cacheImage(ctx, optsHash, *image)
	}
	return image, nil
}

func imageForCaller(ctx context.Context, image models.Image, async bool) (*models.Image, error) {
	if !async && image.Capture != nil {
		var err error
		image, err = image.Capture.Wait(ctx)
		if err != nil {
			return nil, err
		}
	}
	return &image, nil
}

func (s *ScreenshotImageService) cacheImage(ctx context.Context, optsHash string, image models.Image) {
	if err := s.cache.Set(ctx, optsHash, image); err != nil {
		s.logger.Warn("Failed to cache image",
			"token", image.Token,
			"error", err)
	}
}

func (s *ScreenshotImageService) cachedImage(ctx context.Context, optsHash string) (models.Image, bool) {
	image, ok := s.cache.Get(ctx, optsHash)
	if ok && image.Capture != nil {
		if _, err, done := image.Capture.Result(); done && err != nil {
			return models.Image{}, false
		}
	}
	return image, ok
}

func (s *ScreenshotImageService) newAsyncImage(ctx context.Context, opts screenshot.ScreenshotOptions, optsHash string) (models.Image, error) {
	// Serialize task registration with shutdown so Wait cannot race with Add.
	s.backgroundMu.Lock()
	defer s.backgroundMu.Unlock()

	if err := s.backgroundCtx.Err(); err != nil {
		return models.Image{}, err
	}

	image := models.Image{}
	if err := s.store.SaveImage(ctx, &image); err != nil {
		return models.Image{}, fmt.Errorf("failed to save image: %w", err)
	}
	var complete func(models.Image, error, time.Time)
	image.Capture, complete = models.NewImageCapture()
	s.cacheImage(ctx, optsHash, image)

	// Evaluation ends before this work does; preserve its values, but own cancellation.
	backgroundCtx, cancel := context.WithCancel(context.WithoutCancel(ctx))
	stop := context.AfterFunc(s.backgroundCtx, cancel)

	s.backgroundTasks.Go(func() {
		defer cancel()
		defer stop()

		captureCtx, cancelCapture := context.WithTimeout(backgroundCtx, s.screenshotTimeout)
		completed, err := s.captureImage(captureCtx, opts, image)
		cancelCapture()
		if err == nil {
			// An upload timeout must not discard the rendered file. Persistence gets
			// its own bounded deadline while still honoring service shutdown.
			persistCtx, cancelPersist := context.WithTimeout(backgroundCtx, s.screenshotTimeout)
			err = s.saveImage(persistCtx, &completed)
			cancelPersist()
		}
		if err != nil {
			complete(models.Image{}, err, time.Now())
			s.logger.FromContext(backgroundCtx).Warn("Failed to capture image asynchronously", "token", image.Token, "error", err)
			return
		}
		s.cacheImage(backgroundCtx, optsHash, completed)
		complete(completed, nil, time.Now())
	})

	return image, nil
}

func (s *ScreenshotImageService) captureImage(ctx context.Context, opts screenshot.ScreenshotOptions, image models.Image) (models.Image, error) {
	image.Capture = nil

	logger := s.logger.FromContext(ctx).New("dashboard", opts.DashboardUID, "panel", opts.PanelID)

	// The renderer also receives opts.Timeout; bound database queries and rate-limit waits here.
	screenshotCtx, cancel := context.WithTimeout(ctx, s.screenshotTimeout)
	defer cancel()

	captured, err := s.limiter.Do(screenshotCtx, opts, s.screenshots.Take)
	if err != nil {
		if errors.Is(err, dashboards.ErrDashboardNotFound) {
			return image, models.ErrNoDashboard
		}
		return image, err
	}

	logger.Debug("Took screenshot", "path", captured.Path)

	image.Path = captured.Path
	if s.uploads != nil {
		if image, err = s.uploads.Upload(ctx, image); err != nil {
			logger.Warn("Failed to upload image", "error", err)
		} else {
			logger.Debug("Uploaded image", "url", image.URL)
		}
	}

	return image, nil
}

func (s *ScreenshotImageService) saveImage(ctx context.Context, image *models.Image) error {
	if err := s.store.SaveImage(ctx, image); err != nil {
		return fmt.Errorf("failed to save image: %w", err)
	}
	s.logger.FromContext(ctx).Debug("Saved image", "token", image.Token)
	return nil
}
