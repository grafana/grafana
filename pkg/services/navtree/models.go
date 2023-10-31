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
	NavIDCfgGeneral         = "cfg/general"
	NavIDCfgPlugins         = "cfg/plugins"
	NavIDCfgAccess          = "cfg/access"
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
func (root *NavTreeRoot) FindByURL(url string) *NavLink {
	return FindByURL(root.Children, url)
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

func (root *NavTreeRoot) ApplyAdminIA(navAdminSubsectionsEnabled bool) {
	orgAdminNode := root.FindById(NavIDCfg)

	if orgAdminNode != nil {
		adminNodeLinks := []*NavLink{}

		if navAdminSubsectionsEnabled {
			generalNodeLinks := []*NavLink{}
			generalNodeLinks = AppendIfNotNil(generalNodeLinks, root.FindById("upgrading")) // TODO does this even exist
			generalNodeLinks = AppendIfNotNil(generalNodeLinks, root.FindById("licensing"))
			generalNodeLinks = AppendIfNotNil(generalNodeLinks, root.FindById("org-settings"))
			generalNodeLinks = AppendIfNotNil(generalNodeLinks, root.FindById("server-settings"))
			generalNodeLinks = AppendIfNotNil(generalNodeLinks, root.FindById("global-orgs"))
			generalNodeLinks = AppendIfNotNil(generalNodeLinks, root.FindById("feature-toggles"))
			generalNodeLinks = AppendIfNotNil(generalNodeLinks, root.FindById("storage"))

			generalNode := &NavLink{
				Text:     "General",
				SubTitle: "Manage default preferences and settings across Grafana",
				Id:       NavIDCfgGeneral,
				Url:      "/admin/general",
				Icon:     "shield",
				Children: generalNodeLinks,
			}

			pluginsNodeLinks := []*NavLink{}
			pluginsNodeLinks = AppendIfNotNil(pluginsNodeLinks, root.FindById("plugins"))
			pluginsNodeLinks = AppendIfNotNil(pluginsNodeLinks, root.FindById("datasources"))
			pluginsNodeLinks = AppendIfNotNil(pluginsNodeLinks, root.FindById("recordedQueries"))
			pluginsNodeLinks = AppendIfNotNil(pluginsNodeLinks, root.FindById("correlations"))
			pluginsNodeLinks = AppendIfNotNil(pluginsNodeLinks, root.FindById("plugin-page-grafana-cloud-link-app"))

			pluginsNode := &NavLink{
				Text:     "Plugins and data",
				SubTitle: "Install plugins and define the relationships between data",
				Id:       NavIDCfgPlugins,
				Url:      "/admin/plugins",
				Icon:     "shield",
				Children: pluginsNodeLinks,
			}

			accessNodeLinks := []*NavLink{}
			accessNodeLinks = AppendIfNotNil(accessNodeLinks, root.FindById("global-users"))
			accessNodeLinks = AppendIfNotNil(accessNodeLinks, root.FindById("teams"))
			accessNodeLinks = AppendIfNotNil(accessNodeLinks, root.FindById("standalone-plugin-page-/a/grafana-auth-app"))
			accessNodeLinks = AppendIfNotNil(accessNodeLinks, root.FindById("serviceaccounts"))
			accessNodeLinks = AppendIfNotNil(accessNodeLinks, root.FindById("apikeys"))

			usersNode := &NavLink{
				Text:     "Users and access",
				SubTitle: "Configure access for individual users, teams, and service accounts",
				Id:       NavIDCfgAccess,
				Url:      "/admin/access",
				Icon:     "shield",
				Children: accessNodeLinks,
			}

			if len(generalNode.Children) > 0 {
				adminNodeLinks = append(adminNodeLinks, generalNode)
			}

			if len(pluginsNode.Children) > 0 {
				adminNodeLinks = append(adminNodeLinks, pluginsNode)
			}

			if len(usersNode.Children) > 0 {
				adminNodeLinks = append(adminNodeLinks, usersNode)
			}

			authenticationNode := root.FindById("authentication")
			if authenticationNode != nil {
				authenticationNode.IsSection = true
				adminNodeLinks = append(adminNodeLinks, authenticationNode)
			}

			costManagementNode := root.FindById("plugin-page-grafana-costmanagementui-app")

			if costManagementNode != nil {
				adminNodeLinks = append(adminNodeLinks, costManagementNode)
			}

			costManagementMetricsNode := root.FindByURL("/a/grafana-costmanagementui-app/metrics")
			adaptiveMetricsNode := root.FindById("plugin-page-grafana-adaptive-metrics-app")

			if costManagementMetricsNode != nil && adaptiveMetricsNode != nil {
				costManagementMetricsNode.Children = append(costManagementMetricsNode.Children, adaptiveMetricsNode)
			}

			costManagementLogsNode := root.FindByURL("/a/grafana-costmanagementui-app/logs")
			logVolumeExplorerNode := root.FindById("plugin-page-grafana-logvolumeexplorer-app")

			if costManagementLogsNode != nil && logVolumeExplorerNode != nil {
				costManagementLogsNode.Children = append(costManagementLogsNode.Children, logVolumeExplorerNode)
			}
		} else {
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
			adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("feature-toggles"))

			adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("upgrading"))
			adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("licensing"))
			adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("recordedQueries")) // enterprise only
			adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("correlations"))
			adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("plugin-page-grafana-cloud-link-app"))

			adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("ldap"))
			adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("standalone-plugin-page-/a/grafana-auth-app")) // Cloud Access Policies
			adminNodeLinks = AppendIfNotNil(adminNodeLinks, root.FindById("storage"))
		}

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

func FindByURL(nodes []*NavLink, url string) *NavLink {
	for _, child := range nodes {
		if child.Url == url {
			return child
		} else if len(child.Children) > 0 {
			if found := FindByURL(child.Children, url); found != nil {
				return found
			}
		}
	}

	return nil
}
