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

type PanelPlugin struct {
	Type             string            `json:"type"`
	Name             string            `json:"name"`
	Module           string            `json:"module"`
	StaticRootConfig *StaticRootConfig `json:"staticRoot"`
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

type ExternalPluginNavLink struct {
	Text    string          `json:"text"`
	Icon    string          `json:"icon"`
	Href    string          `json:"href"`
	ReqRole models.RoleType `json:"reqRole"`
}

type ExternalPluginCss struct {
	Light string `json:"light"`
	Dark  string `json:"dark"`
}

type ExternalPlugin struct {
	Type             string                   `json:"type"`
	Routes           []*ExternalPluginRoute   `json:"routes"`
	Js               []*ExternalPluginJs      `json:"js"`
	Css              []*ExternalPluginCss     `json:"css"`
	MainNavLinks     []*ExternalPluginNavLink `json:"mainNavLinks"`
	StaticRootConfig *StaticRootConfig        `json:"staticRoot"`
}

type PluginBundle struct {
	Type              string   `json:"type"`
	Enabled           bool     `json:"enabled"`
	PanelPlugins      []string `json:"panelPlugins"`
	DatasourcePlugins []string `json:"datasourcePlugins"`
	ExternalPlugins   []string `json:"externalPlugins"`
	Module            string   `json:"module"`
}

type EnabledPlugins struct {
	PanelPlugins      []*PanelPlugin
	DataSourcePlugins map[string]*DataSourcePlugin
	ExternalPlugins   []*ExternalPlugin
}

func NewEnabledPlugins() EnabledPlugins {
	return EnabledPlugins{
		PanelPlugins:      make([]*PanelPlugin, 0),
		DataSourcePlugins: make(map[string]*DataSourcePlugin),
		ExternalPlugins:   make([]*ExternalPlugin, 0),
	}
}
