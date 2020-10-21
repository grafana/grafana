package rendering

import (
	"context"
	"fmt"
	"math"
	"net/url"
	"os"
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
		Name:         "RenderingService",
		Instance:     &RenderingService{},
		InitPriority: registry.High,
	})
}

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
	domain          string
	inProgressCount int

	Cfg                *setting.Cfg             `inject:""`
	RemoteCacheService *remotecache.RemoteCache `inject:""`
}

func (rs *RenderingService) Init() error {
	rs.log = log.New("rendering")

	// ensure ImagesDir exists
	err := os.MkdirAll(rs.Cfg.ImagesDir, 0700)
	if err != nil {
		return err
	}

	// set value used for domain attribute of renderKey cookie
	switch {
	case rs.Cfg.RendererUrl != "":
		// RendererCallbackUrl has already been passed, it won't generate an error.
		u, _ := url.Parse(rs.Cfg.RendererCallbackUrl)
		rs.domain = u.Hostname()
	case setting.HttpAddr != setting.DefaultHTTPAddr:
		rs.domain = setting.HttpAddr
	default:
		rs.domain = "localhost"
	}

	return nil
}

func (rs *RenderingService) Run(ctx context.Context) error {
	if rs.remoteAvailable() {
		rs.log = rs.log.New("renderer", "http")
		rs.log.Info("Backend rendering via external http server")
		rs.renderAction = rs.renderViaHttp
		<-ctx.Done()
		return nil
	}

	if rs.pluginAvailable() {
		rs.log = rs.log.New("renderer", "plugin")
		rs.pluginInfo = plugins.Renderer

		if err := rs.startPlugin(ctx); err != nil {
			return err
		}

		rs.renderAction = rs.renderViaPlugin
		<-ctx.Done()
		return nil
	}

	rs.log.Debug("No image renderer found/installed. " +
		"For image rendering support please install the grafana-image-renderer plugin. " +
		"Read more at https://grafana.com/docs/grafana/latest/administration/image_rendering/")

	<-ctx.Done()
	return nil
}

func (rs *RenderingService) pluginAvailable() bool {
	return plugins.Renderer != nil
}

func (rs *RenderingService) remoteAvailable() bool {
	return rs.Cfg.RendererUrl != ""
}

func (rs *RenderingService) IsAvailable() bool {
	return rs.remoteAvailable() || rs.pluginAvailable()
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
	elapsedTime := time.Since(startTime).Milliseconds()
	result, err := rs.render(ctx, opts)
	if err != nil {
		if err == ErrTimeout {
			metrics.MRenderingRequestTotal.WithLabelValues("timeout").Inc()
			metrics.MRenderingSummary.WithLabelValues("timeout").Observe(float64(elapsedTime))
		} else {
			metrics.MRenderingRequestTotal.WithLabelValues("failure").Inc()
			metrics.MRenderingSummary.WithLabelValues("failure").Observe(float64(elapsedTime))
		}

		return nil, err
	}

	metrics.MRenderingRequestTotal.WithLabelValues("success").Inc()
	metrics.MRenderingSummary.WithLabelValues("success").Observe(float64(elapsedTime))
	return result, nil
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
	renderKey, err := rs.generateAndStoreRenderKey(opts.OrgId, opts.UserId, opts.OrgRole)
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

func (rs *RenderingService) getFilePathForNewImage() (string, error) {
	rand, err := util.GetRandomString(20)
	if err != nil {
		return "", err
	}
	pngPath, err := filepath.Abs(filepath.Join(rs.Cfg.ImagesDir, rand))
	if err != nil {
		return "", err
	}

	return pngPath + ".png", nil
}

func (rs *RenderingService) getURL(path string) string {
	if rs.Cfg.RendererUrl != "" {
		// The backend rendering service can potentially be remote.
		// So we need to use the root_url to ensure the rendering service
		// can reach this Grafana instance.

		// &render=1 signals to the legacy redirect layer to
		return fmt.Sprintf("%s%s&render=1", rs.Cfg.RendererCallbackUrl, path)
	}

	protocol := setting.Protocol
	switch setting.Protocol {
	case setting.HTTPScheme:
		protocol = "http"
	case setting.HTTP2Scheme, setting.HTTPSScheme:
		protocol = "https"
	}

	subPath := ""
	if rs.Cfg.ServeFromSubPath {
		subPath = rs.Cfg.AppSubUrl
	}

	// &render=1 signals to the legacy redirect layer to
	return fmt.Sprintf("%s://%s:%s%s/%s&render=1", protocol, rs.domain, setting.HttpPort, subPath, path)
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
