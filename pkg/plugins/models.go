package plugins

import (
	"github.com/grafana/grafana/pkg/models"
)

type PluginCommon struct {
	Type       string     `json:"type"`
	Name       string     `json:"name"`
	Id         string     `json:"id"`
	StaticRoot string     `json:"staticRoot"`
	Info       PluginInfo `json:"info"`
}

type PluginInfo struct {
	Author      PluginInfoLink   `json:"author"`
	Description string           `json:"description"`
	Links       []PluginInfoLink `json:"links"`
	Logos       PluginLogos      `json:"logos"`
}

type PluginInfoLink struct {
	Name string `json:"name"`
	Url  string `json:"url"`
}

type PluginLogos struct {
	Small string `json:"small"`
	Large string `json:"large"`
}

type DataSourcePlugin struct {
	PluginCommon
	Module             string                 `json:"module"`
	ServiceName        string                 `json:"serviceName"`
	Partials           map[string]interface{} `json:"partials"`
	DefaultMatchFormat string                 `json:"defaultMatchFormat"`
	Annotations        bool                   `json:"annotations"`
	Metrics            bool                   `json:"metrics"`
	BuiltIn            bool                   `json:"builtIn"`
	App                string                 `json:"app"`
}

type PluginStaticRoute struct {
	Directory string
	PluginId  string
}

type PanelPlugin struct {
	PluginCommon
	Module string `json:"module"`
	App    string `json:"app"`
}

type ApiPluginRoute struct {
	Path            string          `json:"path"`
	Method          string          `json:"method"`
	ReqSignedIn     bool            `json:"reqSignedIn"`
	ReqGrafanaAdmin bool            `json:"reqGrafanaAdmin"`
	ReqRole         models.RoleType `json:"reqRole"`
	Url             string          `json:"url"`
	App             string          `json:"app"`
}

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

type ApiPlugin struct {
	PluginCommon
	Routes []*ApiPluginRoute `json:"routes"`
	App    string            `json:"app"`
}

type AppPlugin struct {
	PluginCommon
	Enabled bool           `json:"enabled"`
	Pinned  bool           `json:"pinned"`
	Module  string         `json:"module"`
	Css     *AppPluginCss  `json:"css"`
	Page    *AppPluginPage `json:"page"`
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
