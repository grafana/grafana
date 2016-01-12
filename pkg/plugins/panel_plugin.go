package plugins

import "encoding/json"

type PanelPlugin struct {
	FrontendPluginBase
}

func (p *PanelPlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&p); err != nil {
		return err
	}

	p.PluginDir = pluginDir
	p.initFrontendPlugin()
	Panels[p.Id] = p

	return nil
}
