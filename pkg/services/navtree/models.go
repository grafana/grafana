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

type NavTreeRoot struct {
	Children []*NavLink
}

func (root *NavTreeRoot) AddSection(node *NavLink) {
	root.Children = append(root.Children, node)
}

func (root *NavTreeRoot) RemoveSection(node *NavLink) {
	var result []*NavLink

	for _, child := range root.Children {
		if child != node {
			result = append(result, child)
		}
	}

	root.Children = result
}

func (root *NavTreeRoot) FindById(id string) *NavLink {
	return FindById(root.Children, id)
}

func FindById(nodes []*NavLink, id string) *NavLink {
	for _, child := range nodes {
		if child.Id == id {
			return child
		} else if len(child.Children) > 0 {
			found := FindById(child.Children, id)
			if found != nil {
				return found
			}
		}
	}

	return nil
}
