package rendering

import (
	"context"
	"fmt"
	"path/filepath"

	plugin "github.com/hashicorp/go-plugin"

	pluginModel "github.com/grafana/grafana-plugin-model/go/renderer"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	registry.RegisterService(&RenderingService{})
}

type RenderingService struct {
	log          log.Logger
	pluginClient *plugin.Client
	grpcPlugin   pluginModel.RendererPlugin
	pluginInfo   *plugins.RendererPlugin
	renderAction renderFunc

	Cfg *setting.Cfg `inject:""`
}

func (rs *RenderingService) Init() error {
	rs.log = log.New("rendering")
	return nil
}

func (rs *RenderingService) Run(ctx context.Context) error {
	if rs.Cfg.RendererUrl != "" {
		rs.log.Info("Backend rendering via external http server")
		rs.renderAction = rs.renderViaHttp
		<-ctx.Done()
		return nil
	}

	if plugins.Renderer == nil {
		rs.renderAction = rs.renderViaPhantomJS
		<-ctx.Done()
		return nil
	}

	rs.pluginInfo = plugins.Renderer

	if err := rs.startPlugin(ctx); err != nil {
		return err
	}

	rs.renderAction = rs.renderViaPlugin

	err := rs.watchAndRestartPlugin(ctx)

	if rs.pluginClient != nil {
		rs.log.Debug("Killing renderer plugin process")
		rs.pluginClient.Kill()
	}

	return err
}

func (rs *RenderingService) Render(ctx context.Context, opts Opts) (*RenderResult, error) {
	if rs.renderAction != nil {
		return rs.renderAction(ctx, opts)
	} else {
		return nil, fmt.Errorf("No renderer found")
	}
}

func (rs *RenderingService) getFilePathForNewImage() string {
	pngPath, _ := filepath.Abs(filepath.Join(rs.Cfg.ImagesDir, util.GetRandomString(20)))
	return pngPath + ".png"
}

func (rs *RenderingService) getURL(path string) string {
	// &render=1 signals to the legacy redirect layer to
	return fmt.Sprintf("%s://%s:%s/%s&render=1", setting.Protocol, rs.getLocalDomain(), setting.HttpPort, path)
}

func (rs *RenderingService) getLocalDomain() string {
	if setting.HttpAddr != setting.DEFAULT_HTTP_ADDR {
		return setting.HttpAddr
	}

	return "localhost"
}

func (rs *RenderingService) getRenderKey(orgId, userId int64, orgRole models.RoleType) string {
	return middleware.AddRenderAuthKey(orgId, userId, orgRole)
}
