package plugins

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type DataSourcePlugin struct {
	FrontendPluginBase
	Annotations   bool `json:"annotations"`
	Metrics       bool `json:"metrics"`
	Alerting      bool `json:"alerting"`
	MinInterval   bool `json:"minInterval,omitempty"`
	CacheTimeout  bool `json:"cacheTimeout,omitempty"`
	MaxDataPoints bool `json:"maxDataPoints,omitempty"`
	BuiltIn       bool `json:"builtIn,omitempty"`
	Mixed         bool `json:"mixed,omitempty"`
	HasHelp       bool `json:"hasHelp,omitempty"`

	Routes []*AppPluginRoute `json:"-"`
}

func (p *DataSourcePlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&p); err != nil {
		return err
	}

	if err := p.registerPlugin(pluginDir); err != nil {
		return err
	}

	// look for help markdown
	helpPath := filepath.Join(p.PluginDir, "HELP.md")
	if _, err := os.Stat(helpPath); os.IsNotExist(err) {
		helpPath = filepath.Join(p.PluginDir, "help.md")
	}
	if _, err := os.Stat(helpPath); err == nil {
		p.HasHelp = true
	}

	DataSources[p.Id] = p
	return nil
}
