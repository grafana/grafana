package plugins

import (
	"github.com/grafana/grafana/pkg/models"
)

type PluginInfo struct {
	Author      PluginAuthor `json:"author"`
	Description string       `json:"description"`
	Homepage    string       `json:"homepage"`
	Logos       PluginLogos  `json:"logos"`
}

type PluginAuthor struct {
	Name string `json:"name"`
	Url  string `json:"url"`
}

type PluginLogos struct {
	Small string `json:"small"`
	Large string `json:"large"`
}

type DataSourcePlugin struct {
	Type               string                 `json:"type"`
	Name               string                 `json:"name"`
	ServiceName        string                 `json:"serviceName"`
	Module             string                 `json:"module"`
	Partials           map[string]interface{} `json:"partials"`
	DefaultMatchFormat string                 `json:"defaultMatchFormat"`
	Annotations        bool                   `json:"annotations"`
	Metrics            bool                   `json:"metrics"`
	BuiltIn            bool                   `json:"builtIn"`
	App                string                 `json:"app"`
	PublicContent      *PublicContent         `json:"public"`
}

type PanelPlugin struct {
	Type          string         `json:"type"`
	Name          string         `json:"name"`
	Module        string         `json:"module"`
	PublicContent *PublicContent `json:"public"`
	App           string         `json:"app"`
}

type PublicContent struct {
	UrlFragment string `json:"urlFragment"`
	Dir         string `json:"dir"`
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
	Type   string            `json:"type"`
	Routes []*ApiPluginRoute `json:"routes"`
	App    string            `json:"app"`
}

type AppPlugin struct {
	Type          string         `json:"type"`
	Name          string         `json:"name"`
	Enabled       bool           `json:"enabled"`
	Pinned        bool           `json:"pinned"`
	Module        string         `json:"module"`
	Css           *AppPluginCss  `json:"css"`
	Page          *AppPluginPage `json:"page"`
	PublicContent *PublicContent `json:"public"`
	Info          *PluginInfo    `json:"info"`
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
