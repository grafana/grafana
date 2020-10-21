package plugins

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

type PanelPlugin struct {
	FrontendPluginBase
	SkipDataQuery bool `json:"skipDataQuery"`
}

func (p *PanelPlugin) Load(decoder *json.Decoder, base *PluginBase, backendPluginManager backendplugin.Manager) error {
	if err := decoder.Decode(p); err != nil {
		return err
	}

	if err := p.registerPlugin(base); err != nil {
		return err
	}

	Panels[p.Id] = p
	return nil
}
