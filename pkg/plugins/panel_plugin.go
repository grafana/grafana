package plugins

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

type PanelPlugin struct {
	FrontendPluginBase
	SkipDataQuery bool `json:"skipDataQuery"`
	AlignData bool `json:"alignData"`
}

func (p *PanelPlugin) Load(decoder *json.Decoder, base *PluginBase, backendPluginManager backendplugin.Manager) (
	interface{}, error) {
	if err := decoder.Decode(p); err != nil {
		return nil, err
	}

	return p, nil
}
