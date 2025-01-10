package rendering

import (
	"context"
	"encoding/gob"
	"errors"
	"fmt"
	"math"
	"net/url"
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
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var _ Service = (*RenderingService)(nil)

type RenderingService struct {
	log               log.Logger
	plugin            Plugin
	renderAction      renderFunc
	renderCSVAction   renderCSVFunc
	sanitizeSVGAction sanitizeFunc
	sanitizeURL       string
	domain            string
	inProgressCount   int32
	version           string
	versionMutex      sync.RWMutex
	capabilities      []Capability
	pluginAvailable   bool

	perRequestRenderKeyProvider renderKeyProvider
	Cfg                         *setting.Cfg
	features                    featuremgmt.FeatureToggles
	RemoteCacheService          *remotecache.RemoteCache
	RendererPluginManager       PluginManager
}

type PluginManager interface {
	Renderer(ctx context.Context) (Plugin, bool)
}

type Plugin interface {
	Client() (pluginextensionv2.RendererPlugin, error)
	Start(ctx context.Context) error
	Version() string
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, remoteCache *remotecache.RemoteCache, rm PluginManager) (*RenderingService, error) {
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

	// URL for HTTP sanitize API
	var sanitizeURL string

	//  value used for domain attribute of renderKey cookie
	var domain string

	switch {
	case cfg.RendererUrl != "":
		// RendererCallbackUrl has already been passed, it won't generate an error.
		u, err := url.Parse(cfg.RendererCallbackUrl)
		if err != nil {
			return nil, err
		}

		sanitizeURL = getSanitizerURL(cfg.RendererUrl)
		domain = u.Hostname()
	case cfg.HTTPAddr != setting.DefaultHTTPAddr:
		domain = cfg.HTTPAddr
	default:
		domain = "localhost"
	}

	var renderKeyProvider renderKeyProvider
	if features.IsEnabledGlobally(featuremgmt.FlagRenderAuthJWT) {
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

	_, exists := rm.Renderer(context.Background())

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
				name:             SVGSanitization,
				semverConstraint: ">= 3.5.0",
			},
			{
				name:             PDFRendering,
				semverConstraint: ">= 3.10.0",
			},
		},
		Cfg:                   cfg,
		features:              features,
		RemoteCacheService:    remoteCache,
		RendererPluginManager: rm,
		log:                   logger,
		domain:                domain,
		sanitizeURL:           sanitizeURL,
		pluginAvailable:       exists,
	}

	gob.Register(&RenderUser{})

	return s, nil
}

func getSanitizerURL(rendererURL string) string {
	rendererBaseURL := strings.TrimSuffix(rendererURL, "/render")
	return rendererBaseURL + "/sanitize"
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
		rs.sanitizeSVGAction = rs.sanitizeViaHTTP

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

	if rp, exists := rs.RendererPluginManager.Renderer(ctx); exists {
		rs.log = rs.log.New("renderer", "plugin")
		rs.plugin = rp
		if err := rs.plugin.Start(ctx); err != nil {
			return err
		}
		rs.version = rp.Version()
		rs.renderAction = rs.renderViaPlugin
		rs.renderCSVAction = rs.renderCSVViaPlugin
		rs.sanitizeSVGAction = rs.sanitizeSVGViaPlugin
		<-ctx.Done()

		return nil
	}

	rs.log.Debug("No image renderer found/installed. " +
		"For image rendering support please install the grafana-image-renderer plugin. " +
		"Read more at https://grafana.com/docs/grafana/latest/administration/image_rendering/")

	<-ctx.Done()
	return nil
}

func (rs *RenderingService) remoteAvailable() bool {
	return rs.Cfg.RendererUrl != ""
}

func (rs *RenderingService) IsAvailable(ctx context.Context) bool {
	return rs.remoteAvailable() || rs.pluginAvailable
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
func (rs *RenderingService) Render(ctx context.Context, renderType RenderType, opts Opts, session Session) (*RenderResult, error) {
	startTime := time.Now()

	renderKeyProvider := rs.perRequestRenderKeyProvider
	if session != nil {
		renderKeyProvider = session
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
			"For image rendering support please install the grafana-image-renderer plugin. " +
			"Read more at https://grafana.com/docs/grafana/latest/administration/image_rendering/")
		if opts.ErrorRenderUnavailable {
			return nil, ErrRenderUnavailable
		}
		return rs.renderUnavailableImage(), nil
	}

	if int(atomic.LoadInt32(&rs.inProgressCount)) > opts.ConcurrentLimit {
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

	defer func() {
		metrics.MRenderingQueue.Set(float64(atomic.AddInt32(&rs.inProgressCount, -1)))
	}()
	metrics.MRenderingQueue.Set(float64(atomic.AddInt32(&rs.inProgressCount, 1)))

	if renderType == RenderPDF {
		if !rs.features.IsEnabled(ctx, featuremgmt.FlagNewPDFRendering) {
			return nil, fmt.Errorf("feature 'newPDFRendering' disabled")
		}

		if err := rs.IsCapabilitySupported(ctx, PDFRendering); err != nil {
			return nil, err
		}
	}

	logger.Info("Rendering", "path", opts.Path, "userID", opts.AuthOpts.UserID)
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

func (rs *RenderingService) RenderCSV(ctx context.Context, opts CSVOpts, session Session) (*RenderCSVResult, error) {
	startTime := time.Now()

	renderKeyProvider := rs.perRequestRenderKeyProvider
	if session != nil {
		renderKeyProvider = session
	}
	result, err := rs.renderCSV(ctx, opts, renderKeyProvider)

	elapsedTime := time.Since(startTime).Milliseconds()
	saveMetrics(elapsedTime, err, RenderCSV)

	return result, err
}

func (rs *RenderingService) SanitizeSVG(ctx context.Context, req *SanitizeSVGRequest) (*SanitizeSVGResponse, error) {
	capability, err := rs.HasCapability(ctx, SVGSanitization)
	if err != nil {
		return nil, err
	}

	if !capability.IsSupported {
		return nil, fmt.Errorf("svg sanitization unsupported, requires image renderer version: %s", capability.SemverConstraint)
	}

	start := time.Now()

	action, err := rs.sanitizeSVGAction(ctx, req)
	rs.log.Info("svg sanitization finished", "duration", time.Since(start), "filename", req.Filename, "isError", err != nil)

	return action, err
}

func (rs *RenderingService) renderCSV(ctx context.Context, opts CSVOpts, renderKeyProvider renderKeyProvider) (*RenderCSVResult, error) {
	logger := rs.log.FromContext(ctx)

	if !rs.IsAvailable(ctx) {
		return nil, ErrRenderUnavailable
	}

	if int(atomic.LoadInt32(&rs.inProgressCount)) > opts.ConcurrentLimit {
		return nil, ErrConcurrentLimitReached
	}

	logger.Info("Rendering", "path", opts.Path)
	renderKey, err := renderKeyProvider.get(ctx, opts.AuthOpts)
	if err != nil {
		return nil, err
	}

	defer renderKeyProvider.afterRequest(ctx, opts.AuthOpts, renderKey)

	defer func() {
		metrics.MRenderingQueue.Set(float64(atomic.AddInt32(&rs.inProgressCount, -1)))
	}()

	metrics.MRenderingQueue.Set(float64(atomic.AddInt32(&rs.inProgressCount, 1)))
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

// getGrafanaCallbackURL creates a URL to send to the image rendering as callback for rendering a Grafana resource
func (rs *RenderingService) getGrafanaCallbackURL(path string) string {
	if rs.Cfg.RendererUrl != "" {
		// The backend rendering service can potentially be remote.
		// So we need to use the root_url to ensure the rendering service
		// can reach this Grafana instance.

		// &render=1 signals to the legacy redirect layer to
		return fmt.Sprintf("%s%s&render=1", rs.Cfg.RendererCallbackUrl, path)
	}

	protocol := rs.Cfg.Protocol
	switch protocol {
	case setting.HTTPScheme:
		protocol = "http"
	case setting.HTTP2Scheme, setting.HTTPSScheme:
		protocol = "https"
	default:
		// TODO: Handle other schemes?
	}

	subPath := ""
	if rs.Cfg.ServeFromSubPath {
		subPath = rs.Cfg.AppSubURL
	}

	// &render=1 signals to the legacy redirect layer to
	return fmt.Sprintf("%s://%s:%s%s/%s&render=1", protocol, rs.domain, rs.Cfg.HTTPPort, subPath, path)
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
