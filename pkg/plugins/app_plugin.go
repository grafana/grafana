package plugins

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/models"
)

type AppPluginPage struct {
	Name    string          `json:"name"`
	Url     string          `json:"url"`
	ReqRole models.RoleType `json:"reqRole"`
}

type AppPluginCss struct {
	Light string `json:"light"`
	Dark  string `json:"dark"`
}

type AppPlugin struct {
	FrontendPluginBase
	Css   *AppPluginCss    `json:"css"`
	Pages []*AppPluginPage `json:"pages"`

	Pinned  bool `json:"-"`
	Enabled bool `json:"-"`
}

func (app *AppPlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&app); err != nil {
		return err
	}

	if app.Css != nil {
		app.Css.Dark = evalRelativePluginUrlPath(app.Css.Dark, app.Id)
		app.Css.Light = evalRelativePluginUrlPath(app.Css.Light, app.Id)
	}

	app.PluginDir = pluginDir
	app.initFrontendPlugin()
	Apps[app.Id] = app
	return nil
}
