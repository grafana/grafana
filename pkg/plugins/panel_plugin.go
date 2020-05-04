package plugins

import (
	"encoding/json"
	"path"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type PanelPlugin struct {
	FrontendPluginBase
	SkipDataQuery bool   `json:"skipDataQuery"`
	Executable    string `json:"executable,omitempty"`
}

func (p *PanelPlugin) Load(decoder *json.Decoder, pluginDir string, backendPluginManager backendplugin.Manager) error {
	if err := decoder.Decode(p); err != nil {
		return err
	}

	if err := p.registerPlugin(pluginDir); err != nil {
		return err
	}

	if p.Backend {
		cmd := ComposePluginStartCommmand(p.Executable)
		fullpath := path.Join(p.PluginDir, cmd)
		descriptor := backendplugin.NewBackendPluginDescriptor(p.Id, fullpath, backendplugin.PluginStartFuncs{})
		if err := backendPluginManager.Register(descriptor); err != nil {
			return errutil.Wrapf(err, "Failed to register backend plugin")
		}
	}

	Panels[p.Id] = p
	return nil
}
