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
	Theme                   string
	NewGrafanaVersionExists bool
	NewGrafanaVersion       string
	AppName                 string
	AppNameBodyClass        string
	FavIcon                 string
	AppleTouchIcon          string
	AppTitle                string
}

type PluginCss struct {
	Light string `json:"light"`
	Dark  string `json:"dark"`
}

const (
	// These weights may be used by an extension to reliably place
	// itself in relation to a particular item in the menu. The weights
	// are negative to ensure that the default items are placed above
	// any items with default weight.

	WeightCreate = (iota - 20) * 100
	WeightDashboard
	WeightExplore
	WeightProfile
	WeightAlerting
	WeightPlugin
	WeightConfig
	WeightAdmin
	WeightHelp
)

type NavLink struct {
	Id           string     `json:"id,omitempty"`
	Text         string     `json:"text,omitempty"`
	Description  string     `json:"description,omitempty"`
	SubTitle     string     `json:"subTitle,omitempty"`
	Icon         string     `json:"icon,omitempty"`
	Img          string     `json:"img,omitempty"`
	Url          string     `json:"url,omitempty"`
	Target       string     `json:"target,omitempty"`
	SortWeight   int64      `json:"sortWeight,omitempty"`
	Divider      bool       `json:"divider,omitempty"`
	HideFromMenu bool       `json:"hideFromMenu,omitempty"`
	HideFromTabs bool       `json:"hideFromTabs,omitempty"`
	Children     []*NavLink `json:"children,omitempty"`
}
