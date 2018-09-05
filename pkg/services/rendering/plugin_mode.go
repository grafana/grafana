package rendering

import (
	"context"
	"fmt"
	"os/exec"
	"path"
	"time"

	pluginModel "github.com/grafana/grafana-plugin-model/go/renderer"
	"github.com/grafana/grafana/pkg/plugins"
	plugin "github.com/hashicorp/go-plugin"
)

func (rs *RenderingService) startPlugin(ctx context.Context) error {
	cmd := plugins.ComposePluginStartCommmand("plugin_start")
	fullpath := path.Join(rs.pluginInfo.PluginDir, cmd)

	var handshakeConfig = plugin.HandshakeConfig{
		ProtocolVersion:  1,
		MagicCookieKey:   "grafana_plugin_type",
		MagicCookieValue: "renderer",
	}

	rs.log.Info("Renderer plugin found, starting", "cmd", cmd)

	rs.pluginClient = plugin.NewClient(&plugin.ClientConfig{
		HandshakeConfig: handshakeConfig,
		Plugins: map[string]plugin.Plugin{
			plugins.Renderer.Id: &pluginModel.RendererPluginImpl{},
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

	rs.grpcPlugin = raw.(pluginModel.RendererPlugin)

	return nil
}

func (rs *RenderingService) watchAndRestartPlugin(ctx context.Context) error {
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

func (rs *RenderingService) renderViaPlugin(ctx context.Context, opts Opts) (*RenderResult, error) {
	pngPath := rs.getFilePathForNewImage()

	rsp, err := rs.grpcPlugin.Render(ctx, &pluginModel.RenderRequest{
		Url:       rs.getURL(opts.Path),
		Width:     int32(opts.Width),
		Height:    int32(opts.Height),
		FilePath:  pngPath,
		Timeout:   int32(opts.Timeout.Seconds()),
		RenderKey: rs.getRenderKey(opts.OrgId, opts.UserId, opts.OrgRole),
		Encoding:  opts.Encoding,
		Timezone:  isoTimeOffsetToPosixTz(opts.Timezone),
		Domain:    rs.domain,
	})

	if err != nil {
		return nil, err
	}

	if rsp.Error != "" {
		return nil, fmt.Errorf("Rendering failed: %v", rsp.Error)
	}

	return &RenderResult{FilePath: pngPath}, err
}
