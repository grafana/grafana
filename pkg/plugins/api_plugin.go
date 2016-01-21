package plugins

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/models"
)

type ApiPluginRoute struct {
	Path            string            `json:"path"`
	Method          string            `json:"method"`
	ReqSignedIn     bool              `json:"reqSignedIn"`
	ReqGrafanaAdmin bool              `json:"reqGrafanaAdmin"`
	ReqRole         models.RoleType   `json:"reqRole"`
	Url             string            `json:"url"`
	Headers         []ApiPluginHeader `json:"headers"`
}

type ApiPlugin struct {
	PluginBase
	Routes []*ApiPluginRoute `json:"routes"`
}

type ApiPluginHeader struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

func (app *ApiPlugin) Load(decoder *json.Decoder, pluginDir string) error {
	if err := decoder.Decode(&app); err != nil {
		return err
	}

	app.PluginDir = pluginDir

	ApiPlugins[app.Id] = app
	return nil
}
