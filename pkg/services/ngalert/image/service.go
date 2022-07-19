package image

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
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

//go:generate mockgen -destination=mock.go -package=image github.com/grafana/grafana/pkg/services/ngalert/image ImageService
type ImageService interface {
	// NewImage returns a new image for the alert instance.
	NewImage(ctx context.Context, r *ngmodels.AlertRule) (*ngmodels.Image, error)
}

// ScreenshotImageService takes screenshots of the alert rule and saves the
// image in the store. The image contains a unique token that can be passed
// as an annotation or label to the Alertmanager. This service cannot take
// screenshots of alert rules that are not associated with a dashboard panel.
type ScreenshotImageService struct {
	screenshots screenshot.ScreenshotService
	store       store.ImageStore
}

func NewScreenshotImageService(screenshots screenshot.ScreenshotService, store store.ImageStore) ImageService {
	return &ScreenshotImageService{
		screenshots: screenshots,
		store:       store,
	}
}

// NewScreenshotImageServiceFromCfg returns a new ScreenshotImageService
// from the configuration.
func NewScreenshotImageServiceFromCfg(cfg *setting.Cfg, metrics prometheus.Registerer,
	db *store.DBstore, ds dashboards.DashboardService, rs rendering.Service) (ImageService, error) {
	// If screenshots are disabled then return the ScreenshotUnavailableService
	if !cfg.UnifiedAlerting.Screenshots.Capture {
		return &ScreenshotImageService{
			screenshots: &screenshot.ScreenshotUnavailableService{},
		}, nil
	}

	// Image uploading is an optional feature of screenshots
	s := screenshot.NewRemoteRenderScreenshotService(ds, rs)
	if cfg.UnifiedAlerting.Screenshots.UploadExternalImageStorage {
		u, err := imguploader.NewImageUploader()
		if err != nil {
			return nil, fmt.Errorf("failed to initialize uploading screenshot service: %w", err)
		}
		s = screenshot.NewUploadingScreenshotService(metrics, s, u)
	}
	s = screenshot.NewRateLimitScreenshotService(s, cfg.UnifiedAlerting.Screenshots.MaxConcurrentScreenshots)
	s = screenshot.NewSingleFlightScreenshotService(s)
	s = screenshot.NewCachableScreenshotService(metrics, screenshotCacheTTL, s)
	s = screenshot.NewObservableScreenshotService(metrics, s)
	return &ScreenshotImageService{
		store:       db,
		screenshots: s,
	}, nil
}

// NewImage returns a screenshot of the alert rule or an error.
//
// The alert rule must be associated with a dashboard panel for a screenshot to be
// taken. If the alert rule does not have a Dashboard UID in its annotations,
// or the dashboard does not exist, an ErrNoDashboard error is returned. If the
// alert rule has a Dashboard UID and the dashboard exists, but does not have a
// Panel ID in its annotations then an ErrNoPanel error is returned.
func (s *ScreenshotImageService) NewImage(ctx context.Context, r *ngmodels.AlertRule) (*ngmodels.Image, error) {
	if r.DashboardUID == nil {
		return nil, ErrNoDashboard
	}
	if r.PanelID == nil || *r.PanelID == 0 {
		return nil, ErrNoPanel
	}

	ctx, cancelFunc := context.WithTimeout(ctx, screenshotTimeout)
	defer cancelFunc()

	screenshot, err := s.screenshots.Take(ctx, screenshot.ScreenshotOptions{
		Timeout:      screenshotTimeout,
		DashboardUID: *r.DashboardUID,
		PanelID:      *r.PanelID,
	})
	if err != nil {
		// TODO: Check for screenshot upload failures. These images should still be
		// stored because we have a local disk path that could be useful.
		if errors.Is(err, models.ErrDashboardNotFound) {
			return nil, ErrNoDashboard
		}
		return nil, err
	}

	v := ngmodels.Image{
		Path: screenshot.Path,
		URL:  screenshot.URL,
	}
	if err := s.store.SaveImage(ctx, &v); err != nil {
		return nil, fmt.Errorf("failed to save image: %w", err)
	}

	return &v, nil
}

type NotAvailableImageService struct{}

func (s *NotAvailableImageService) NewImage(ctx context.Context, r *ngmodels.AlertRule) (*ngmodels.Image, error) {
	return nil, screenshot.ErrScreenshotsUnavailable
}

type NoopImageService struct{}

func (s *NoopImageService) NewImage(ctx context.Context, r *ngmodels.AlertRule) (*ngmodels.Image, error) {
	return &ngmodels.Image{}, nil
}
