package plugins

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type DataSourcePlugin struct {
	FrontendPluginBase
	Annotations  bool              `json:"annotations"`
	Metrics      bool              `json:"metrics"`
	Alerting     bool              `json:"alerting"`
	QueryOptions map[string]bool   `json:"queryOptions,omitempty"`
	BuiltIn      bool              `json:"builtIn,omitempty"`
	Mixed        bool              `json:"mixed,omitempty"`
	HasQueryHelp bool              `json:"hasQueryHelp,omitempty"`
	Routes       []*AppPluginRoute `json:"routes"`
}

func (p *DataSourcePlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&p); err != nil {
		return err
	}

	if err := p.registerPlugin(pluginDir); err != nil {
		return err
	}

	// look for help markdown
	helpPath := filepath.Join(p.PluginDir, "QUERY_HELP.md")
	if _, err := os.Stat(helpPath); os.IsNotExist(err) {
		helpPath = filepath.Join(p.PluginDir, "query_help.md")
	}
	if _, err := os.Stat(helpPath); err == nil {
		p.HasQueryHelp = true
	}

	DataSources[p.Id] = p
	return nil
}
