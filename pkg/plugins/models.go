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
}

type ExternalPluginRoute struct {
	Path            string          `json:"path"`
	Method          string          `json:"method"`
	ReqSignedIn     bool            `json:"req_signed_in"`
	ReqGrafanaAdmin bool            `json:"req_grafana_admin"`
	ReqRole         models.RoleType `json:"req_role"`
	Url             string          `json:"url"`
}

type ExternalPluginJs struct {
	Src string `json:"src"`
}

type ExternalPluginMenuItem struct {
	Text string `json:"text"`
	Icon string `json:"icon"`
	Href string `json:"href"`
}

type ExternalPluginCss struct {
	Href string `json:"href"`
}

type ExternalPluginSettings struct {
	Routes    []*ExternalPluginRoute    `json:"routes"`
	Js        []*ExternalPluginJs       `json:"js"`
	Css       []*ExternalPluginCss      `json:"css"`
	MenuItems []*ExternalPluginMenuItem `json:"menu_items"`
}

type ExternalPlugin struct {
	PluginType string                 `json:"pluginType"`
	Settings   ExternalPluginSettings `json:"settings"`
}
