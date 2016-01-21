package plugins

import (
	"encoding/json"
	"strings"

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

type AppIncludeInfo struct {
	Name string `json:"name"`
	Type string `json:"type"`
	Id   string `json:"id"`
}

type AppPlugin struct {
	FrontendPluginBase
	Css      *AppPluginCss    `json:"css"`
	Pages    []AppPluginPage  `json:"pages"`
	Includes []AppIncludeInfo `json:"-"`

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

	// check if we have child panels
	for _, panel := range Panels {
		if strings.HasPrefix(panel.PluginDir, app.PluginDir) {
			panel.IncludedInAppId = app.Id
			app.Includes = append(app.Includes, AppIncludeInfo{
				Name: panel.Name,
				Id:   panel.Id,
				Type: panel.Type,
			})
		}
	}

	// check if we have child apiPlugins
	for _, plugin := range ApiPlugins {
		if strings.HasPrefix(plugin.PluginDir, app.PluginDir) {
			plugin.IncludedInAppId = app.Id
			app.Includes = append(app.Includes, AppIncludeInfo{
				Name: plugin.Name,
				Id:   plugin.Id,
				Type: plugin.Type,
			})
		}
	}

	Apps[app.Id] = app
	return nil
}
