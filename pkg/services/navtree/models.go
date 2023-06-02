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
	WeightExplore
	WeightAlerting
	WeightAlertsAndIncidents
	WeightMonitoring
	WeightDataConnections
	WeightApps
	WeightPlugin
	WeightConfig
	WeightAdmin
	WeightProfile
	WeightHelp
)

const (
	NavIDRoot               = "root"
	NavIDDashboards         = "dashboards/browse"
	NavIDCfg                = "cfg" // NavIDCfg is the id for org configuration navigation node
	NavIDAlertsAndIncidents = "alerts-and-incidents"
	NavIDAlerting           = "alerting"
	NavIDAlertingLegacy     = "alerting-legacy"
	NavIDMonitoring         = "monitoring"
	NavIDReporting          = "reports"
	NavIDApps               = "apps"
)

type NavLink struct {
	Id             string     `json:"id,omitempty"`
	Text           string     `json:"text"`
	SubTitle       string     `json:"subTitle,omitempty"`
	Icon           string     `json:"icon,omitempty"` // Available icons can be browsed in Storybook: https://developers.grafana.com/ui/latest/index.html?path=/story/docs-overview-icon--icons-overview
	Img            string     `json:"img,omitempty"`
	Url            string     `json:"url,omitempty"`
	Target         string     `json:"target,omitempty"`
	SortWeight     int64      `json:"sortWeight,omitempty"`
	HideFromTabs   bool       `json:"hideFromTabs,omitempty"`
	RoundIcon      bool       `json:"roundIcon,omitempty"`
	IsSection      bool       `json:"isSection,omitempty"`
	Children       []*NavLink `json:"children,omitempty"`
	HighlightText  string     `json:"highlightText,omitempty"`
	HighlightID    string     `json:"highlightId,omitempty"`
	EmptyMessageId string     `json:"emptyMessageId,omitempty"`
	PluginID       string     `json:"pluginId,omitempty"` // (Optional) The ID of the plugin that registered nav link (e.g. as a standalone plugin page)
	IsCreateAction bool       `json:"isCreateAction,omitempty"`
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

func (root *NavTreeRoot) ApplyAdminIA() {
	orgAdminNode := root.FindById(NavIDCfg)

	if orgAdminNode != nil {
		adminNodeLinks := []*NavLink{}

		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("datasources"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("plugins"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("global-users"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("teams"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("serviceaccounts"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("apikeys"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("org-settings"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("authentication"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("server-settings"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("global-orgs"))

		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("upgrading"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("licensing"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("recordedQueries")) // enterprise only
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("correlations"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("plugin-page-grafana-cloud-link-app"))

		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("ldap"))
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("standalone-plugin-page-/a/grafana-auth-app")) // Cloud Access Policies
		adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("storage"))

		if len(adminNodeLinks) > 0 {
			orgAdminNode.Children = adminNodeLinks
		} else {
			root.RemoveSection(orgAdminNode)
		}
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
