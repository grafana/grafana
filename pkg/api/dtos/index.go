package dtos

type IndexViewData struct {
	User               *CurrentUser
	Settings           map[string]interface{}
	AppUrl             string
	AppSubUrl          string
	GoogleAnalyticsId  string
	GoogleTagManagerId string

	PluginCss     []*PluginCss
	PluginModules []string
	MainNavLinks  []*NavLink
}

type PluginCss struct {
	Light string `json:"light"`
	Dark  string `json:"dark"`
}

type NavLink struct {
	Text string `json:"text"`
	Icon string `json:"icon"`
	Url  string `json:"url"`
}
