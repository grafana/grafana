package dtos

type IndexViewData struct {
	User                    *CurrentUser
	Settings                map[string]interface{}
	AppUrl                  string
	AppSubUrl               string
	GoogleAnalyticsId       string
	GoogleTagManagerId      string
	NavTree                 []*NavLink
	BuildVersion            string
	BuildCommit             string
	NewGrafanaVersionExists bool
	NewGrafanaVersion       string
}

type PluginCss struct {
	Light string `json:"light"`
	Dark  string `json:"dark"`
}

type NavLink struct {
	Id          string     `json:"id,omitempty"`
	Text        string     `json:"text,omitempty"`
	Description string     `json:"description,omitempty"`
	Icon        string     `json:"icon,omitempty"`
	Img         string     `json:"img,omitempty"`
	Url         string     `json:"url,omitempty"`
	Divider     bool       `json:"divider,omitempty"`
	Children    []*NavLink `json:"children,omitempty"`
}
