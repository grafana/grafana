package plugins

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/models"
)

type AppPluginPage struct {
	Text    string          `json:"text"`
	Icon    string          `json:"icon"`
	Url     string          `json:"url"`
	ReqRole models.RoleType `json:"reqRole"`
}

type AppPluginCss struct {
	Light string `json:"light"`
	Dark  string `json:"dark"`
}

type AppPlugin struct {
	FrontendPluginBase
	Enabled bool           `json:"enabled"`
	Pinned  bool           `json:"pinned"`
	Css     *AppPluginCss  `json:"css"`
	Page    *AppPluginPage `json:"page"`
}

func (p *AppPlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&p); err != nil {
		return err
	}

	p.PluginDir = pluginDir
	p.initFrontendPlugin()
	Apps[p.Id] = p
	return nil
}
