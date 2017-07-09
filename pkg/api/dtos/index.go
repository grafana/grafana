package dtos

type IndexViewData struct {
	User               *CurrentUser
	Systems		   interface{}
	Settings           map[string]interface{}
	AppUrl             string
	AppSubUrl          string
	GoogleAnalyticsId  string
	GoogleTagManagerId string
	MainNavLinks       []*NavLink
}

type PluginCss struct {
	Light string `json:"light"`
	Dark  string `json:"dark"`
}

type NavLink struct {
	Text     string     `json:"text,omitempty"`
	Icon     string     `json:"icon,omitempty"`
	Img      string     `json:"img,omitempty"`
	Url      string     `json:"url,omitempty"`
	Divider  bool       `json:"divider,omitempty"`
	Children []*NavLink `json:"children,omitempty"`
}
