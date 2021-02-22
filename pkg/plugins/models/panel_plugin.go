package models

import (
	"encoding/json"

	backendmodels "github.com/grafana/grafana/pkg/plugins/backendplugin/models"
)

type PanelPlugin struct {
	FrontendPluginBase
	SkipDataQuery bool `json:"skipDataQuery"`
}

func (p *PanelPlugin) Load(decoder *json.Decoder, base *PluginBase, backendPluginManager backendmodels.Manager) (
	interface{}, error) {
	if err := decoder.Decode(p); err != nil {
		return nil, err
	}

	return p, nil
}
