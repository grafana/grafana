package plugins

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

type PanelPlugin struct {
	FrontendPluginBase
	SkipDataQuery bool `json:"skipDataQuery"`
}

func (p *PanelPlugin) Load(decoder *json.Decoder, base *PluginBase, backendPluginManager backendplugin.Manager) (
	interface{}, error) {
	if err := decoder.Decode(p); err != nil {
		return nil, err
	}

	if p.Id == "grafana-piechart-panel" {
		p.Name = "Pie Chart (old)"
	}

	return p, nil
}
