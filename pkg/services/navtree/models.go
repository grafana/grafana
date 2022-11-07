package navtree

import (
	"encoding/json"
	"sort"
)

const (
	// These weights may be used by an extension to reliably place
	// itself in relation to a particular item in the menu. The weights
	// are negative to ensure that the default items are placed above
	// any items with default weight.

	WeightHome = (iota - 20) * 100
	WeightSavedItems
	WeightCreate
	WeightDashboard
	WeightQueryLibrary
	WeightExplore
	WeightAlerting
	WeightDataConnections
	WeightPlugin
	WeightConfig
	WeightAlertsAndIncidents
	WeightMonitoring
	WeightApps
	WeightAdmin
	WeightProfile
	WeightHelp
)

const (
	NavSectionCore   string = "core"
	NavSectionPlugin string = "plugin"
	NavSectionConfig string = "config"
)

const (
	NavIDDashboards         = "dashboards"
	NavIDDashboardsBrowse   = "dashboards/browse"
	NavIDCfg                = "cfg" // NavIDCfg is the id for org configuration navigation node
	NavIDAdmin              = "admin"
	NavIDAlertsAndIncidents = "alerts-and-incidents"
	NavIDAlerting           = "alerting"
	NavIDMonitoring         = "monitoring"
	NavIDReporting          = "reports"
	NavIDApps               = "apps"
)

type NavLink struct {
	Id               string     `json:"id,omitempty"`
	Text             string     `json:"text"`
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
	IsSection        bool       `json:"isSection,omitempty"`
	Children         []*NavLink `json:"children,omitempty"`
	HighlightText    string     `json:"highlightText,omitempty"`
	HighlightID      string     `json:"highlightId,omitempty"`
	EmptyMessageId   string     `json:"emptyMessageId,omitempty"`
	PluginID         string     `json:"pluginId,omitempty"` // (Optional) The ID of the plugin that registered nav link (e.g. as a standalone plugin page)
}

func (node *NavLink) Sort() {
	Sort(node.Children)
}

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

func (root *NavTreeRoot) RemoveEmptySectionsAndApplyNewInformationArchitecture(topNavEnabled bool) {
	// Remove server admin node if it has no children or set the url to first child
	if node := root.FindById(NavIDAdmin); node != nil {
		if len(node.Children) == 0 {
			root.RemoveSection(node)
		} else {
			node.Url = node.Children[0].Url
		}
	}

	if topNavEnabled {
		orgAdminNode := root.FindById(NavIDCfg)

		if orgAdminNode != nil {
			orgAdminNode.Url = "/admin"
			orgAdminNode.Text = "Administration"

			adminAccessNodeLinks := []*NavLink{}
			adminAccessNodeLinks = AppendIfNotNil(adminAccessNodeLinks, root.FindById("users"))
			adminAccessNodeLinks = AppendIfNotNil(adminAccessNodeLinks, root.FindById("global-users"))
			adminAccessNodeLinks = AppendIfNotNil(adminAccessNodeLinks, root.FindById("teams"))
			// adminAccessNodeLinks = AppendIfNotNil(adminAccessNodeLinks, rolesNode := root.FindById("roles")) // enterprise only?
			adminAccessNodeLinks = AppendIfNotNil(adminAccessNodeLinks, root.FindById("serviceaccounts"))
			adminAccessNodeLinks = AppendIfNotNil(adminAccessNodeLinks, root.FindById("apikeys"))
			// adminAccessNodeLinks = AppendIfNotNil(adminAccessNodeLinks, root.FindById("cloudAccessPolicies") ) // cloud app?

			adminConfigNodeLinks := []*NavLink{}
			adminConfigNodeLinks = AppendIfNotNil(adminConfigNodeLinks, root.FindById("org-settings"))
			adminConfigNodeLinks = AppendIfNotNil(adminConfigNodeLinks, root.FindById("server-settings"))
			adminConfigNodeLinks = AppendIfNotNil(adminConfigNodeLinks, root.FindById("datasources"))
			adminConfigNodeLinks = AppendIfNotNil(adminConfigNodeLinks, root.FindById("plugins"))
			adminConfigNodeLinks = AppendIfNotNil(adminConfigNodeLinks, root.FindById("global-orgs"))
			// adminConfigNodeLinks = AppendIfNotNil(adminConfigNodeLinks, root.FindById("recordedQueries")) // enterprise only
			// adminConfigNodeLinks = AppendIfNotNil(adminConfigNodeLinks, root.FindById("customBranding")) // enterprise only
			adminConfigNodeLinks = AppendIfNotNil(adminConfigNodeLinks, root.FindById("upgrading")) // but for enterprise?

			adminAccessNode := &NavLink{
				Text:       "Access",
				Id:         "admin/access",
				Url:        "/admin/access",
				Icon:       "shield",
				SortWeight: WeightAdmin,
				Section:    NavSectionConfig,
				Children:   adminAccessNodeLinks,
			}

			adminConfigNode := &NavLink{
				Text:       "Configuration",
				Id:         "admin/config",
				Url:        "/admin/config",
				Icon:       "shield",
				SortWeight: WeightAdmin,
				Section:    NavSectionConfig,
				Children:   adminConfigNodeLinks,
			}

			adminNodeLinks := []*NavLink{}

			adminNodeLinks = append(adminNodeLinks, adminAccessNode)
			adminNodeLinks = append(adminNodeLinks, adminConfigNode)
			orgAdminNode.Children = adminNodeLinks
		}

		if serverAdminNode := root.FindById(NavIDAdmin); serverAdminNode != nil {
			root.RemoveSection(serverAdminNode)
		}

		// Move reports into dashboards
		if reports := root.FindById(NavIDReporting); reports != nil {
			if dashboards := root.FindById(NavIDDashboards); dashboards != nil {
				reports.SortWeight = 0
				dashboards.Children = append(dashboards.Children, reports)
				root.RemoveSection(reports)
			}
		}

		// Change id of dashboards
		if dashboards := root.FindById(NavIDDashboards); dashboards != nil {
			dashboards.Id = "dashboards/browse"
		}
	}

	// Remove top level cfg / administration node if it has no children (needs to be after topnav new info archicture logic above that moves server admin into it)
	// Remove server admin node if it has no children or set the url to first child
	if node := root.FindById(NavIDCfg); node != nil {
		if len(node.Children) == 0 {
			root.RemoveSection(node)
		} else if !topNavEnabled {
			node.Url = node.Children[0].Url
		}
	}
}

func (root *NavTreeRoot) Sort() {
	Sort(root.Children)
}

func (root *NavTreeRoot) MarshalJSON() ([]byte, error) {
	return json.Marshal(root.Children)
}

func Sort(nodes []*NavLink) {
	sort.SliceStable(nodes, func(i, j int) bool {
		iw := nodes[i].SortWeight
		if iw == 0 {
			iw = int64(i) + 1
		}
		jw := nodes[j].SortWeight
		if jw == 0 {
			jw = int64(j) + 1
		}

		return iw < jw
	})

	for _, child := range nodes {
		child.Sort()
	}
}

func AppendIfNotNil(children []*NavLink, newChild *NavLink) []*NavLink {
	if newChild != nil {
		return append(children, newChild)
	}

	return children
}

func FindById(nodes []*NavLink, id string) *NavLink {
	for _, child := range nodes {
		if child.Id == id {
			return child
		} else if len(child.Children) > 0 {
			if found := FindById(child.Children, id); found != nil {
				return found
			}
		}
	}

	return nil
}
