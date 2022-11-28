package navtree

const (
	// These weights may be used by an extension to reliably place
	// itself in relation to a particular item in the menu. The weights
	// are negative to ensure that the default items are placed above
	// any items with default weight.

	WeightSavedItems = (iota - 20) * 100
	WeightCreate
	WeightDashboard
	WeightExplore
	WeightAlerting
	WeightDataConnections
	WeightPlugin
	WeightConfig
	WeightAdmin
	WeightProfile
	WeightHelp
)

const (
	NavSectionCore   string = "core"
	NavSectionPlugin string = "plugin"
	NavSectionConfig string = "config"
)

type NavLink struct {
	Id               string     `json:"id,omitempty"`
	Text             string     `json:"text"`
	Description      string     `json:"description,omitempty"`
	Section          string     `json:"section,omitempty"`
	SubTitle         string     `json:"subTitle,omitempty"`
	Icon             string     `json:"icon,omitempty"` // Available icons can be browsed in Storybook: https://developers.grafana.com/ui/latest/index.html?path=/story/docs-overview-icon--icons-overview
	Img              string     `json:"img,omitempty"`
	Url              string     `json:"url,omitempty"`
	Target           string     `json:"target,omitempty"`
	SortWeight       int64      `json:"sortWeight,omitempty"`
	Divider          bool       `json:"divider,omitempty"`
	HideFromMenu     bool       `json:"hideFromMenu,omitempty"`
	HideFromTabs     bool       `json:"hideFromTabs,omitempty"`
	ShowIconInNavbar bool       `json:"showIconInNavbar,omitempty"`
	RoundIcon        bool       `json:"roundIcon,omitempty"`
	Children         []*NavLink `json:"children,omitempty"`
	HighlightText    string     `json:"highlightText,omitempty"`
	HighlightID      string     `json:"highlightId,omitempty"`
	EmptyMessageId   string     `json:"emptyMessageId,omitempty"`
}

// NavIDCfg is the id for org configuration navigation node
const NavIDCfg = "cfg"

func GetServerAdminNode(children []*NavLink) *NavLink {
	url := ""
	if len(children) > 0 {
		url = children[0].Url
	}
	return &NavLink{
		Text:         "Server admin",
		SubTitle:     "Manage all users and orgs",
		Description:  "Manage server-wide settings and access to resources such as organizations, users, and licenses",
		HideFromTabs: true,
		Id:           "admin",
		Icon:         "shield",
		Url:          url,
		SortWeight:   WeightAdmin,
		Section:      NavSectionConfig,
		Children:     children,
	}
}
