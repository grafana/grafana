package plugins

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/models"
)

type PluginLoader interface {
	Load(decoder *json.Decoder, pluginDir string) error
}

type PluginBase struct {
	Type      string     `json:"type"`
	Name      string     `json:"name"`
	Id        string     `json:"id"`
	App       string     `json:"app"`
	Info      PluginInfo `json:"info"`
	PluginDir string     `json:"-"`
}

type PluginInfo struct {
	Author      PluginInfoLink   `json:"author"`
	Description string           `json:"description"`
	Links       []PluginInfoLink `json:"links"`
	Logos       PluginLogos      `json:"logos"`
	Version     string           `json:"version"`
	Updated     string           `json:"updated"`
}

type PluginInfoLink struct {
	Name string `json:"name"`
	Url  string `json:"url"`
}

type PluginLogos struct {
	Small string `json:"small"`
	Large string `json:"large"`
}

type PluginStaticRoute struct {
	Directory string
	PluginId  string
}

type ApiPluginRoute struct {
	Path            string          `json:"path"`
	Method          string          `json:"method"`
	ReqSignedIn     bool            `json:"reqSignedIn"`
	ReqGrafanaAdmin bool            `json:"reqGrafanaAdmin"`
	ReqRole         models.RoleType `json:"reqRole"`
	Url             string          `json:"url"`
}

type ApiPlugin struct {
	PluginBase
	Routes []*ApiPluginRoute `json:"routes"`
}

type EnabledPlugins struct {
	Panels      []*PanelPlugin
	DataSources map[string]*DataSourcePlugin
	ApiList     []*ApiPlugin
	Apps        []*AppPlugin
}

func NewEnabledPlugins() EnabledPlugins {
	return EnabledPlugins{
		Panels:      make([]*PanelPlugin, 0),
		DataSources: make(map[string]*DataSourcePlugin),
		ApiList:     make([]*ApiPlugin, 0),
		Apps:        make([]*AppPlugin, 0),
	}
}
