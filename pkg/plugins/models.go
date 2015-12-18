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
	App                string                 `json:"app"`
	StaticRootConfig   *StaticRootConfig      `json:"staticRoot"`
}

type PanelPlugin struct {
	Type             string            `json:"type"`
	Name             string            `json:"name"`
	Module           string            `json:"module"`
	StaticRootConfig *StaticRootConfig `json:"staticRoot"`
	App              string            `json:"app"`
}

type StaticRootConfig struct {
	Url  string `json:"url"`
	Path string `json:"path"`
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

type AppPluginJs struct {
	Module string `json:"module"`
}

type AppPluginNavLink struct {
	Text    string          `json:"text"`
	Icon    string          `json:"icon"`
	Href    string          `json:"href"`
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
	Type              string              `json:"type"`
	Enabled           bool                `json:"enabled"`
	PanelPlugins      []string            `json:"panelPlugins"`
	DatasourcePlugins []string            `json:"datasourcePlugins"`
	ApiPlugins        []string            `json:"apiPlugins"`
	Module            string              `json:"module"`
	Js                []*AppPluginJs      `json:"js"`
	Css               []*AppPluginCss     `json:"css"`
	MainNavLinks      []*AppPluginNavLink `json:"mainNavLinks"`
	PinNavLinks       bool                `json:"pinNavLinks"`
	StaticRootConfig  *StaticRootConfig   `json:"staticRoot"`
}

type EnabledPlugins struct {
	PanelPlugins      []*PanelPlugin
	DataSourcePlugins map[string]*DataSourcePlugin
	ApiPlugins        []*ApiPlugin
	AppPlugins        []*AppPlugin
}

func NewEnabledPlugins() EnabledPlugins {
	return EnabledPlugins{
		PanelPlugins:      make([]*PanelPlugin, 0),
		DataSourcePlugins: make(map[string]*DataSourcePlugin),
		ApiPlugins:        make([]*ApiPlugin, 0),
		AppPlugins:        make([]*AppPlugin, 0),
	}
}
