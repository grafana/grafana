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

	p.PluginDir = base.PluginDir
	p.Signature = base.Signature
	p.SignatureType = base.SignatureType
	p.SignatureOrg = base.SignatureOrg

	return p, nil
}
