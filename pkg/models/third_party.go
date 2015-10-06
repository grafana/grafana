package models

type ThirdPartyRoute struct {
	Path            string   `json:"path"`
	Method          string   `json:"method"`
	ReqSignedIn     bool     `json:"req_signed_in"`
	ReqGrafanaAdmin bool     `json:"req_grafana_admin"`
	ReqRole         RoleType `json:"req_role"`
	Url             string   `json:"url"`
}

type ThirdPartyJs struct {
	src string `json:"src"`
}

type ThirdPartyMenuItem struct {
	Text string `json:"text"`
	Icon string `json:"icon"`
	Href string `json:"href"`
}

type ThirdPartyCss struct {
	Href string `json:"href"`
}

type ThirdPartyIntegration struct {
	Routes    []*ThirdPartyRoute    `json:"routes"`
	Js        []*ThirdPartyJs       `json:"js"`
	Css       []*ThirdPartyCss      `json:"css"`
	MenuItems []*ThirdPartyMenuItem `json:"menu_items"`
}
