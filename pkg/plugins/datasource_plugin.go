package plugins

import "encoding/json"

type DataSourcePlugin struct {
	FrontendPluginBase
	Annotations bool   `json:"annotations"`
	Metrics     bool   `json:"metrics"`
	BuiltIn     bool   `json:"builtIn"`
	Mixed       bool   `json:"mixed"`
	App         string `json:"app"`
}

func (p *DataSourcePlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&p); err != nil {
		return err
	}

	if err := p.registerPlugin(pluginDir); err != nil {
		return err
	}

	DataSources[p.Id] = p
	return nil
}
