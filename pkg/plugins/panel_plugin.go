package plugins

import "encoding/json"

type PanelPlugin struct {
	FrontendPluginBase
	DataFormats []string `json:"dataFormats"`
}

func (p *PanelPlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&p); err != nil {
		return err
	}

	if err := p.registerPlugin(pluginDir); err != nil {
		return err
	}

	if p.DataFormats == nil {
		p.DataFormats = []string{"time_series", "table"}
	}

	Panels[p.Id] = p
	return nil
}
