package rendering

import (
	"context"
	"fmt"
	"path"
	"time"

	pluginModel "github.com/grafana/grafana-plugin-model/go/renderer"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

func (rs *RenderingService) startPlugin(ctx context.Context) error {
	cmd := plugins.ComposePluginStartCommmand("plugin_start")
	fullpath := path.Join(rs.pluginInfo.PluginDir, cmd)

	rs.log.Info("Renderer plugin found, starting", "cmd", cmd)

	rs.pluginClient = backendplugin.NewRendererClient(plugins.Renderer.Id, fullpath, rs.log)
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
	pngPath, err := rs.getFilePathForNewImage()
	if err != nil {
		return nil, err
	}

	renderKey, err := rs.getRenderKey(opts.OrgId, opts.UserId, opts.OrgRole)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, opts.Timeout)
	defer cancel()

	rsp, err := rs.grpcPlugin.Render(ctx, &pluginModel.RenderRequest{
		Url:       rs.getURL(opts.Path),
		Width:     int32(opts.Width),
		Height:    int32(opts.Height),
		FilePath:  pngPath,
		Timeout:   int32(opts.Timeout.Seconds()),
		RenderKey: renderKey,
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
