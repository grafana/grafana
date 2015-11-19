package plugins

import "github.com/grafana/grafana/pkg/models"

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
	StaticRootConfig   *StaticRootConfig      `json:"staticRoot"`
}

type StaticRootConfig struct {
	Url  string `json:"url"`
	Path string `json:"path"`
}

type ExternalPluginRoute struct {
	Path            string          `json:"path"`
	Method          string          `json:"method"`
	ReqSignedIn     bool            `json:"reqSignedIn"`
	ReqGrafanaAdmin bool            `json:"reqGrafanaAdmin"`
	ReqRole         models.RoleType `json:"reqRole"`
	Url             string          `json:"url"`
}

type ExternalPluginJs struct {
	Module string `json:"module"`
}

type ExternalPluginMenuItem struct {
	Text string `json:"text"`
	Icon string `json:"icon"`
	Href string `json:"href"`
}

type ExternalPluginCss struct {
	Href string `json:"href"`
}

type ExternalPlugin struct {
	Routes           []*ExternalPluginRoute    `json:"routes"`
	Js               []*ExternalPluginJs       `json:"js"`
	Css              []*ExternalPluginCss      `json:"css"`
	MenuItems        []*ExternalPluginMenuItem `json:"menuItems"`
	StaticRootConfig *StaticRootConfig         `json:"staticRoot"`
}
