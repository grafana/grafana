package models

type ExternalPluginRoute struct {
	Path            string   `json:"path"`
	Method          string   `json:"method"`
	ReqSignedIn     bool     `json:"req_signed_in"`
	ReqGrafanaAdmin bool     `json:"req_grafana_admin"`
	ReqRole         RoleType `json:"req_role"`
	Url             string   `json:"url"`
}

type ExternalPluginJs struct {
	src string `json:"src"`
}

type ExternalPluginMenuItem struct {
	Text string `json:"text"`
	Icon string `json:"icon"`
	Href string `json:"href"`
}

type ExternalPluginCss struct {
	Href string `json:"href"`
}

type ExternalPluginIntegration struct {
	Routes    []*ExternalPluginRoute    `json:"routes"`
	Js        []*ExternalPluginJs       `json:"js"`
	Css       []*ExternalPluginCss      `json:"css"`
	MenuItems []*ExternalPluginMenuItem `json:"menu_items"`
}
