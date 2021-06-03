package plugins

import (
	"context"
	"encoding/json"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type RendererPlugin struct {
	FrontendPluginBase

	Executable           string `json:"executable,omitempty"`
	GrpcPluginV2         pluginextensionv2.RendererPlugin
	backendPluginManager backendplugin.Manager
}

func (r *RendererPlugin) Load(decoder *json.Decoder, base *PluginBase,
	backendPluginManager backendplugin.Manager) (interface{}, error) {
	if err := decoder.Decode(r); err != nil {
		return nil, err
	}

	r.backendPluginManager = backendPluginManager

	cmd := ComposePluginStartCommand("plugin_start")
	fullpath := filepath.Join(base.PluginDir, cmd)
	factory := grpcplugin.NewRendererPlugin(r.Id, fullpath, r.onPluginStart)
	if err := backendPluginManager.Register(r.Id, factory); err != nil {
		return nil, errutil.Wrapf(err, "failed to register backend plugin")
	}

	return r, nil
}

func (r *RendererPlugin) Start(ctx context.Context) error {
	if err := r.backendPluginManager.StartPlugin(ctx, r.Id); err != nil {
		return errutil.Wrapf(err, "Failed to start renderer plugin")
	}

	return nil
}

func (r *RendererPlugin) onPluginStart(pluginID string, renderer pluginextensionv2.RendererPlugin, logger log.Logger) error {
	r.GrpcPluginV2 = renderer
	return nil
}
