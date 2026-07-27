package rendering

import (
	"context"
	"encoding/gob"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var _ Service = (*RenderingService)(nil)

type RenderingService struct {
	log             log.Logger
	renderAction    renderFunc
	renderCSVAction renderCSVFunc
	inProgressCount atomic.Int32
	version         string
	versionMutex    sync.RWMutex
	capabilities    []Capability
	callback        RendererCallback

	imageRendererClient         *Client
	perRequestRenderKeyProvider renderKeyProvider
	Cfg                         *setting.Cfg
	features                    featuremgmt.FeatureToggles
	RemoteCacheService          *remotecache.RemoteCache
}

func ProvideService(cfg *setting.Cfg, cfgProvider setting.Provider, authMiddleware AuthMiddleware, features featuremgmt.FeatureToggles, remoteCache *remotecache.RemoteCache) (*RenderingService, error) {
	folders := []string{
		cfg.ImagesDir,
		cfg.CSVsDir,
		cfg.PDFsDir,
	}

	// ensure folders exists
	for _, f := range folders {
		err := os.MkdirAll(f, 0700)
		if err != nil {
			return nil, fmt.Errorf("failed to create directory %q: %w", f, err)
		}
	}

	logger := log.New("rendering")

	// temp
	callback, err := ResolveCallback(cfgProvider)
	if err != nil {
		return nil, err
	}

	var renderKeyProvider renderKeyProvider
	if cfg.RendererServerUrl != "" {
		//nolint:staticcheck // not yet migrated to OpenFeature
		if features.IsEnabledGlobally(featuremgmt.FlagRenderAuthJWT) {
			// only check if the renderer is configured otherwise we dont need to force changing the default.
			if strings.TrimSpace(cfg.RendererAuthToken) == "" {
				err := "Using an empty [rendering]renderer_token is not allowed, set it to another value. " +
					"Read more at https://grafana.com/docs/grafana/latest/setup-grafana/image-rendering/#security"
				logger.Error(err)
				return nil, fmt.Errorf("failed to start rendering service: %v", err)
			}

			if cfg.RendererAuthToken == setting.DefaultRendererAuthToken {
				if cfg.Env == setting.Dev {
					logger.Warn("Using the default [rendering]renderer_token is not allowed for production settings, and Grafana will refuse to start.")
				} else {
					err := "Using the default [rendering]renderer_token is not allowed for production settings, set it to another value. " +
						"Read more at https://grafana.com/docs/grafana/latest/setup-grafana/image-rendering/#security"
					logger.Error(err)
					return nil, fmt.Errorf("failed to start rendering service: %v", err)
				}
			}

			// overwrite the default key provider when we know we have a better way.
			renderKeyProvider = &jwtRenderKeyProvider{
				log:       logger,
				authToken: []byte(cfg.RendererAuthToken),
				keyExpiry: cfg.RendererRenderKeyLifeTime,
			}
		} else {
			renderKeyProvider = &perRequestRenderKeyProvider{
				cache:     remoteCache,
				log:       logger,
				keyExpiry: cfg.RendererRenderKeyLifeTime,
			}
		}
	}

	imageRendererClient := NewClient(cfgProvider, authMiddleware)

	s := &RenderingService{
		perRequestRenderKeyProvider: renderKeyProvider,
		capabilities: []Capability{
			{
				name:             FullHeightImages,
				semverConstraint: ">= 3.4.0",
			},
			{
				name:             ScalingDownImages,
				semverConstraint: ">= 3.4.0",
			},
			{
				name:             PDFRendering,
				semverConstraint: ">= 3.10.0",
			},
		},
		Cfg:                 cfg,
		features:            features,
		RemoteCacheService:  remoteCache,
		log:                 logger,
		callback:            callback,
		imageRendererClient: imageRendererClient,
	}

	gob.Register(&RenderUser{})

	return s, nil
}

func (rs *RenderingService) Run(ctx context.Context) error {
	if rs.remoteAvailable() {
		rs.log = rs.log.New("renderer", "http")

		rs.getRemotePluginVersionWithRetry(func(version string, err error) {
			if err != nil {
				rs.log.Info("Couldn't get remote renderer version", "err", err)
			}

			rs.log.Info("Backend rendering via external http server", "version", version)

			rs.versionMutex.Lock()
			defer rs.versionMutex.Unlock()

			rs.version = version
		})
		rs.renderAction = rs.renderViaHTTP
		rs.renderCSVAction = rs.renderCSVViaHTTP

		refreshTicker := time.NewTicker(remoteVersionRefreshInterval)

		for {
			select {
			case <-refreshTicker.C:
				go rs.refreshRemotePluginVersion()
			case <-ctx.Done():
				rs.log.Debug("Grafana is shutting down - stopping image-renderer version refresh")
				refreshTicker.Stop()
				return nil
			}
		}
	}

	rs.log.Debug("No image renderer found/installed. " +
		"For image rendering support please use the Grafana Image Renderer remote rendering service. " +
		"Read more at https://grafana.com/docs/grafana/latest/administration/image_rendering/")

	<-ctx.Done()
	return nil
}

func (rs *RenderingService) remoteAvailable() bool {
	return rs.Cfg.RendererServerUrl != ""
}

func (rs *RenderingService) IsAvailable(ctx context.Context) bool {
	return rs.remoteAvailable()
}

func (rs *RenderingService) Version() string {
	rs.versionMutex.RLock()
	defer rs.versionMutex.RUnlock()

	return rs.version
}

func (rs *RenderingService) RenderErrorImage(theme models.Theme, err error) (*RenderResult, error) {
	if theme == "" {
		theme = models.ThemeDark
	}
	imgUrl := "public/img/rendering_%s_%s.png"
	if errors.Is(err, ErrTimeout) || errors.Is(err, ErrServerTimeout) {
		imgUrl = fmt.Sprintf(imgUrl, "timeout", theme)
	} else {
		imgUrl = fmt.Sprintf(imgUrl, "error", theme)
	}

	imgPath := filepath.Join(rs.Cfg.HomePath, imgUrl)
	if _, err := os.Stat(imgPath); errors.Is(err, os.ErrNotExist) {
		return nil, err
	}

	return &RenderResult{
		FilePath: imgPath,
	}, nil
}

func (rs *RenderingService) renderUnavailableImage() *RenderResult {
	imgPath := "public/img/rendering_plugin_not_installed.png"

	return &RenderResult{
		FilePath: filepath.Join(rs.Cfg.HomePath, imgPath),
	}
}

// Render calls the grafana image renderer and returns Grafana resource as PNG or PDF
func (rs *RenderingService) Render(ctx context.Context, renderType RenderType, opts Opts) (*RenderResult, error) {
	startTime := time.Now()

	renderKeyProvider := rs.perRequestRenderKeyProvider
	if renderKeyProvider == nil {
		// Rendering is not configured. Just reject the token; it has no reasonable use here.
		return nil, ErrRenderUnavailable
	}

	result, err := rs.render(ctx, renderType, opts, renderKeyProvider)

	elapsedTime := time.Since(startTime).Milliseconds()
	saveMetrics(elapsedTime, err, renderType)

	return result, err
}

func (rs *RenderingService) render(ctx context.Context, renderType RenderType, opts Opts, renderKeyProvider renderKeyProvider) (*RenderResult, error) {
	logger := rs.log.FromContext(ctx)

	if !rs.IsAvailable(ctx) {
		logger.Warn("Could not render image, no image renderer found/installed. " +
			"For image rendering support please use the Grafana Image Renderer remote rendering service. " +
			"Read more at https://grafana.com/docs/grafana/latest/administration/image_rendering/")
		if opts.ErrorRenderUnavailable {
			return nil, ErrRenderUnavailable
		}
		return rs.renderUnavailableImage(), nil
	}

	newInProgressCount := rs.inProgressCount.Add(1)

	defer func() {
		metrics.MRenderingQueue.Set(float64(rs.inProgressCount.Add(-1)))
	}()
	metrics.MRenderingQueue.Set(float64(newInProgressCount))

	if opts.ConcurrentLimit > 0 && int(newInProgressCount) > opts.ConcurrentLimit {
		logger.Warn("Could not render image, hit the currency limit", "concurrencyLimit", opts.ConcurrentLimit, "path", opts.Path)
		if opts.ErrorConcurrentLimitReached {
			return nil, ErrConcurrentLimitReached
		}

		theme := models.ThemeDark
		if opts.Theme != "" {
			theme = opts.Theme
		}
		filePath := fmt.Sprintf("public/img/rendering_limit_%s.png", theme)
		return &RenderResult{
			FilePath: filepath.Join(rs.Cfg.HomePath, filePath),
		}, nil
	}

	if renderType == RenderPDF {
		if err := rs.IsCapabilitySupported(ctx, PDFRendering); err != nil {
			return nil, err
		}
	}

	logger.Info("Rendering", "path", opts.Path, "userID", opts.UserID)
	if math.IsInf(opts.DeviceScaleFactor, 0) || math.IsNaN(opts.DeviceScaleFactor) || opts.DeviceScaleFactor == 0 {
		opts.DeviceScaleFactor = 1
	}
	renderKey, err := renderKeyProvider.get(ctx, opts.AuthOpts)
	if err != nil {
		return nil, err
	}

	defer renderKeyProvider.afterRequest(ctx, opts.AuthOpts, renderKey)

	res, err := rs.renderAction(ctx, renderType, renderKey, opts)
	if err != nil {
		logger.Error("Failed to render image", "path", opts.Path, "error", err)
		return nil, err
	}
	logger.Debug("Successfully rendered image", "path", opts.Path)

	return res, nil
}

func (rs *RenderingService) RenderCSV(ctx context.Context, opts CSVOpts) (*RenderCSVResult, error) {
	startTime := time.Now()

	renderKeyProvider := rs.perRequestRenderKeyProvider
	if renderKeyProvider == nil {
		// Rendering is not configured. Just reject the token; it has no reasonable use here.
		return nil, ErrRenderUnavailable
	}

	result, err := rs.renderCSV(ctx, opts, renderKeyProvider)

	elapsedTime := time.Since(startTime).Milliseconds()
	saveMetrics(elapsedTime, err, RenderCSV)

	return result, err
}

func (rs *RenderingService) renderCSV(ctx context.Context, opts CSVOpts, renderKeyProvider renderKeyProvider) (*RenderCSVResult, error) {
	logger := rs.log.FromContext(ctx)

	if !rs.IsAvailable(ctx) {
		return nil, ErrRenderUnavailable
	}

	newInProgressCount := rs.inProgressCount.Add(1)

	defer func() {
		metrics.MRenderingQueue.Set(float64(rs.inProgressCount.Add(-1)))
	}()
	metrics.MRenderingQueue.Set(float64(newInProgressCount))

	if opts.ConcurrentLimit > 0 && int(newInProgressCount) > opts.ConcurrentLimit {
		return nil, ErrConcurrentLimitReached
	}

	logger.Info("Rendering", "path", opts.Path)
	renderKey, err := renderKeyProvider.get(ctx, opts.AuthOpts)
	if err != nil {
		return nil, err
	}

	defer renderKeyProvider.afterRequest(ctx, opts.AuthOpts, renderKey)

	return rs.renderCSVAction(ctx, renderKey, opts)
}

func (rs *RenderingService) getNewFilePath(rt RenderType) (string, error) {
	rand, err := util.GetRandomString(20)
	if err != nil {
		return "", err
	}

	var ext string
	var folder string
	switch rt {
	case RenderCSV:
		ext = "csv"
		folder = rs.Cfg.CSVsDir
	case RenderPDF:
		ext = "pdf"
		folder = rs.Cfg.PDFsDir
	default:
		ext = "png"
		folder = rs.Cfg.ImagesDir
	}

	return filepath.Abs(filepath.Join(folder, fmt.Sprintf("%s.%s", rand, ext)))
}

func isoTimeOffsetToPosixTz(isoOffset string) string {
	// invert offset
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
