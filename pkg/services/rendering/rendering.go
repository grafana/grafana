package rendering

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/remotecache"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	remotecache.Register(&RenderUser{})
	registry.Register(&registry.Descriptor{
		Name:         ServiceName,
		Instance:     &RenderingService{},
		InitPriority: registry.High,
	})
}

const ServiceName = "RenderingService"
const renderKeyPrefix = "render-%s"

type RenderUser struct {
	OrgID   int64
	UserID  int64
	OrgRole string
}

type RenderingService struct {
	log             log.Logger
	pluginInfo      *plugins.RendererPlugin
	renderAction    renderFunc
	renderCSVAction renderCSVFunc
	domain          string
	inProgressCount int
	version         string

	Cfg                *setting.Cfg             `inject:""`
	RemoteCacheService *remotecache.RemoteCache `inject:""`
	PluginManager      plugins.Manager          `inject:""`
}

func (rs *RenderingService) Init() error {
	rs.log = log.New("rendering")

	// ensure ImagesDir exists
	err := os.MkdirAll(rs.Cfg.ImagesDir, 0700)
	if err != nil {
		return fmt.Errorf("failed to create images directory %q: %w", rs.Cfg.ImagesDir, err)
	}

	// ensure CSVsDir exists
	err = os.MkdirAll(rs.Cfg.CSVsDir, 0700)
	if err != nil {
		return fmt.Errorf("failed to create CSVs directory %q: %w", rs.Cfg.CSVsDir, err)
	}

	// set value used for domain attribute of renderKey cookie
	switch {
	case rs.Cfg.RendererUrl != "":
		// RendererCallbackUrl has already been passed, it won't generate an error.
		u, _ := url.Parse(rs.Cfg.RendererCallbackUrl)
		rs.domain = u.Hostname()
	case rs.Cfg.HTTPAddr != setting.DefaultHTTPAddr:
		rs.domain = rs.Cfg.HTTPAddr
	default:
		rs.domain = "localhost"
	}

	return nil
}

func (rs *RenderingService) Run(ctx context.Context) error {
	if rs.remoteAvailable() {
		rs.log = rs.log.New("renderer", "http")

		version, err := rs.getRemotePluginVersion()
		if err != nil {
			rs.log.Info("Couldn't get remote renderer version", "err", err)
		}

		rs.log.Info("Backend rendering via external http server", "version", version)
		rs.version = version
		rs.renderAction = rs.renderViaHTTP
		rs.renderCSVAction = rs.renderCSVViaHTTP
		<-ctx.Done()
		return nil
	}

	if rs.pluginAvailable() {
		rs.log = rs.log.New("renderer", "plugin")
		rs.pluginInfo = rs.PluginManager.Renderer()

		if err := rs.startPlugin(ctx); err != nil {
			return err
		}

		rs.version = rs.pluginInfo.Info.Version
		rs.renderAction = rs.renderViaPlugin
		rs.renderCSVAction = rs.renderCSVViaPlugin
		<-ctx.Done()

		// On Windows, Chromium is generating a debug.log file that breaks signature check on next restart
		debugFilePath := path.Join(rs.pluginInfo.PluginDir, "chrome-win/debug.log")
		if _, err := os.Stat(debugFilePath); err == nil {
			err = os.Remove(debugFilePath)
			if err != nil {
				rs.log.Warn("Couldn't remove debug.log file, the renderer plugin will not be able to pass the signature check until this file is deleted",
					"err", err)
			}
		}

		return nil
	}

	rs.log.Debug("No image renderer found/installed. " +
		"For image rendering support please install the grafana-image-renderer plugin. " +
		"Read more at https://grafana.com/docs/grafana/latest/administration/image_rendering/")

	<-ctx.Done()
	return nil
}

func (rs *RenderingService) pluginAvailable() bool {
	return rs.PluginManager.Renderer() != nil
}

func (rs *RenderingService) remoteAvailable() bool {
	return rs.Cfg.RendererUrl != ""
}

func (rs *RenderingService) IsAvailable() bool {
	return rs.remoteAvailable() || rs.pluginAvailable()
}

func (rs *RenderingService) Version() string {
	return rs.version
}

func (rs *RenderingService) RenderErrorImage(err error) (*RenderResult, error) {
	imgUrl := "public/img/rendering_error.png"

	return &RenderResult{
		FilePath: filepath.Join(setting.HomePath, imgUrl),
	}, nil
}

func (rs *RenderingService) renderUnavailableImage() *RenderResult {
	imgPath := "public/img/rendering_plugin_not_installed.png"

	return &RenderResult{
		FilePath: filepath.Join(setting.HomePath, imgPath),
	}
}

func (rs *RenderingService) Render(ctx context.Context, opts Opts) (*RenderResult, error) {
	startTime := time.Now()
	result, err := rs.render(ctx, opts)

	elapsedTime := time.Since(startTime).Milliseconds()
	saveMetrics(elapsedTime, err, RenderPNG)

	return result, err
}

func (rs *RenderingService) render(ctx context.Context, opts Opts) (*RenderResult, error) {
	if rs.inProgressCount > opts.ConcurrentLimit {
		return &RenderResult{
			FilePath: filepath.Join(setting.HomePath, "public/img/rendering_limit.png"),
		}, nil
	}

	if !rs.IsAvailable() {
		rs.log.Warn("Could not render image, no image renderer found/installed. " +
			"For image rendering support please install the grafana-image-renderer plugin. " +
			"Read more at https://grafana.com/docs/grafana/latest/administration/image_rendering/")
		return rs.renderUnavailableImage(), nil
	}

	rs.log.Info("Rendering", "path", opts.Path)
	if math.IsInf(opts.DeviceScaleFactor, 0) || math.IsNaN(opts.DeviceScaleFactor) || opts.DeviceScaleFactor <= 0 {
		opts.DeviceScaleFactor = 1
	}
	renderKey, err := rs.generateAndStoreRenderKey(opts.OrgID, opts.UserID, opts.OrgRole)
	if err != nil {
		return nil, err
	}

	defer rs.deleteRenderKey(renderKey)

	defer func() {
		rs.inProgressCount--
		metrics.MRenderingQueue.Set(float64(rs.inProgressCount))
	}()

	rs.inProgressCount++
	metrics.MRenderingQueue.Set(float64(rs.inProgressCount))
	return rs.renderAction(ctx, renderKey, opts)
}

func (rs *RenderingService) RenderCSV(ctx context.Context, opts CSVOpts) (*RenderCSVResult, error) {
	startTime := time.Now()
	result, err := rs.renderCSV(ctx, opts)

	elapsedTime := time.Since(startTime).Milliseconds()
	saveMetrics(elapsedTime, err, RenderCSV)

	return result, err
}

func (rs *RenderingService) renderCSV(ctx context.Context, opts CSVOpts) (*RenderCSVResult, error) {
	if rs.inProgressCount > opts.ConcurrentLimit {
		return nil, ErrConcurrentLimitReached
	}

	if !rs.IsAvailable() {
		return nil, ErrRenderUnavailable
	}

	rs.log.Info("Rendering", "path", opts.Path)
	renderKey, err := rs.generateAndStoreRenderKey(opts.OrgID, opts.UserID, opts.OrgRole)
	if err != nil {
		return nil, err
	}

	defer rs.deleteRenderKey(renderKey)

	defer func() {
		rs.inProgressCount--
		metrics.MRenderingQueue.Set(float64(rs.inProgressCount))
	}()

	rs.inProgressCount++
	metrics.MRenderingQueue.Set(float64(rs.inProgressCount))
	return rs.renderCSVAction(ctx, renderKey, opts)
}

func (rs *RenderingService) GetRenderUser(key string) (*RenderUser, bool) {
	val, err := rs.RemoteCacheService.Get(fmt.Sprintf(renderKeyPrefix, key))
	if err != nil {
		rs.log.Error("Failed to get render key from cache", "error", err)
	}

	if val != nil {
		if user, ok := val.(*RenderUser); ok {
			return user, true
		}
	}

	return nil, false
}

func (rs *RenderingService) getNewFilePath(rt RenderType) (string, error) {
	rand, err := util.GetRandomString(20)
	if err != nil {
		return "", err
	}

	ext := "png"
	folder := rs.Cfg.ImagesDir
	if rt == RenderCSV {
		ext = "csv"
		folder = rs.Cfg.CSVsDir
	}

	return filepath.Abs(filepath.Join(folder, fmt.Sprintf("%s.%s", rand, ext)))
}

func (rs *RenderingService) getURL(path string) string {
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

func (rs *RenderingService) generateAndStoreRenderKey(orgId, userId int64, orgRole models.RoleType) (string, error) {
	key, err := util.GetRandomString(32)
	if err != nil {
		return "", err
	}

	err = rs.RemoteCacheService.Set(fmt.Sprintf(renderKeyPrefix, key), &RenderUser{
		OrgID:   orgId,
		UserID:  userId,
		OrgRole: string(orgRole),
	}, 5*time.Minute)
	if err != nil {
		return "", err
	}

	return key, nil
}

func (rs *RenderingService) deleteRenderKey(key string) {
	err := rs.RemoteCacheService.Delete(fmt.Sprintf(renderKeyPrefix, key))
	if err != nil {
		rs.log.Error("Failed to delete render key", "error", err)
	}
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
