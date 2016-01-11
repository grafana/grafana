package plugins

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/models"
)

type AppPluginPage struct {
	Text    string          `json:"text"`
	Url     string          `json:"url"`
	ReqRole models.RoleType `json:"reqRole"`
}

type AppPluginCss struct {
	Light string `json:"light"`
	Dark  string `json:"dark"`
}

type AppPlugin struct {
	FrontendPluginBase
	Css  *AppPluginCss    `json:"css"`
	Page []*AppPluginPage `json:"page"`

	Pinned  bool `json:"-"`
	Enabled bool `json:"-"`
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
