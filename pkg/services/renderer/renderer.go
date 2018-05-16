package renderer

import (
	"context"
	"fmt"
	"os/exec"
	"path"
	"runtime"
	"strings"
	"time"

	plugin "github.com/hashicorp/go-plugin"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	. "github.com/grafana/grafana/pkg/services/renderer/client"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	registry.RegisterService(&RenderService{})
}

type RenderService struct {
	log          log.Logger
	pluginClient *plugin.Client
	grpcPlugin   RendererPlugin
	pluginInfo   *plugins.RendererPlugin
}

func (rs *RenderService) Init() error {
	rs.log = log.New("renderer")
	return nil
}

func (rs *RenderService) Test() {

}

func (rs *RenderService) Run(ctx context.Context) error {
	if plugins.Renderer == nil {
		rs.log.Info("No renderer plugin found")
		<-ctx.Done()
		return nil
	}

	rs.pluginInfo = plugins.Renderer

	if err := rs.startPlugin(ctx); err != nil {
		return err
	}

	err := rs.watchAndRestartPlugin(ctx)

	if rs.pluginClient != nil {
		rs.log.Debug("Killing renderer plugin process")
		rs.pluginClient.Kill()
	}

	return err
}

func (rs *RenderService) startPlugin(ctx context.Context) error {
	cmd := composeBinaryName("plugin_start", runtime.GOOS, runtime.GOARCH)
	fullpath := path.Join(rs.pluginInfo.PluginDir, cmd)

	var handshakeConfig = plugin.HandshakeConfig{
		ProtocolVersion:  1,
		MagicCookieKey:   "grafana_plugin_type",
		MagicCookieValue: "renderer",
	}

	rs.log.Info("Renderer path", "fullpath", fullpath)

	rs.pluginClient = plugin.NewClient(&plugin.ClientConfig{
		HandshakeConfig: handshakeConfig,
		Plugins: map[string]plugin.Plugin{
			plugins.Renderer.Id: &RendererPluginImpl{},
		},
		Cmd:              exec.Command(fullpath),
		AllowedProtocols: []plugin.Protocol{plugin.ProtocolGRPC},
		Logger:           plugins.LogWrapper{Logger: rs.log},
	})

	rpcClient, err := rs.pluginClient.Client()
	if err != nil {
		return err
	}

	raw, err := rpcClient.Dispense(rs.pluginInfo.Id)
	if err != nil {
		return err
	}

	rs.grpcPlugin = raw.(RendererPlugin)

	return nil
}

func (rs *RenderService) watchAndRestartPlugin(ctx context.Context) error {
	ticker := time.NewTicker(time.Second * 1)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if rs.pluginClient.Exited() {
				err := rs.startPlugin(ctx)
				rs.log.Debug("Render plugin existed, restarting...")
				if err != nil {
					rs.log.Error("Failed to start render plugin", err)
				}
			}
		}
	}
}

func (rs *RenderService) Render(opts Opts) (string, error) {
	rsp, err := rs.grpcPlugin.Render(context.Background(), &RenderRequest{
		Url: "test",
	})

	if err != nil {
		return "", err
	}

	rs.log.Info("Response", "rsp", rsp.FilePath)

	return "localhost", err
}

func getURL(path string) string {
	// return "http://localhost:3000/api"
	return fmt.Sprintf("%s://%s:%s/%s", setting.Protocol, getLocalDomain(), setting.HttpPort, path)
}

func getLocalDomain() string {
	if setting.HttpAddr != setting.DEFAULT_HTTP_ADDR {
		return setting.HttpAddr
	}

	return "localhost"
}

func (rs *RenderService) getRenderKey(orgId, userId int64, orgRole models.RoleType) string {
	rs.log.Debug("adding render authkey", "orgid", orgId, "userid", userId, "role", orgRole)
	return middleware.AddRenderAuthKey(orgId, userId, orgRole)
}

func composeBinaryName(executable, os, arch string) string {
	var extension string
	os = strings.ToLower(os)
	if os == "windows" {
		extension = ".exe"
	}

	return fmt.Sprintf("%s_%s_%s%s", executable, os, strings.ToLower(arch), extension)
}
