package dtos

type IndexViewData struct {
	User               *CurrentUser
	Settings           map[string]interface{}
	AppUrl             string
	AppSubUrl          string
	GoogleAnalyticsId  string
	GoogleTagManagerId string

	PluginCss    []string
	PluginJs     []string
	MainNavLinks []*NavLink
}

type NavLink struct {
	Text string `json:"text"`
	Icon string `json:"icon"`
	Href string `json:"href"`
}
