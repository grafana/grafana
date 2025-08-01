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
	WeightBookmarks
	WeightSavedItems
	WeightDashboard
	WeightExplore
	WeightDrilldown
	WeightAssistant
	WeightAlerting
	WeightAlertsAndIncidents
	WeightAIAndML
	WeightTestingAndSynthetics
	WeightObservability
	WeightCloudServiceProviders
	WeightInfrastructure
	WeightApplication
	WeightFrontend
	WeightAsserts
	WeightDataConnections
	WeightApps
	WeightPlugin
	WeightConfig
	WeightProfile
	WeightHelp
)

const (
	NavIDRoot                 = "root"
	NavIDDashboards           = "dashboards/browse"
	NavIDExplore              = "explore"
	NavIDDrilldown            = "drilldown"
	NavIDCfg                  = "cfg" // NavIDCfg is the id for org configuration navigation node
	NavIDAlertsAndIncidents   = "alerts-and-incidents"
	NavIDAIMachineLearning    = "ai-and-machine-learning"
	NavIDTestingAndSynthetics = "testing-and-synthetics"
	NavIDAlerting             = "alerting"
	NavIDObservability        = "observability"
	NavIDInfrastructure       = "infrastructure"
	NavIDFrontend             = "frontend"
	NavIDReporting            = "reports"
	NavIDApps                 = "apps"
	NavIDCfgGeneral           = "cfg/general"
	NavIDCfgPlugins           = "cfg/plugins"
	NavIDCfgAccess            = "cfg/access"
	NavIDBookmarks            = "bookmarks"
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
	IsNew          bool       `json:"isNew,omitempty"` // (Optional) Adds "New!" badge to the nav link and expands it by default
	Keywords       []string   `json:"keywords,omitempty"`
	ParentItem     *NavLink   `json:"parentItem,omitempty"` // (Optional) The parent item of the nav link
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

// RemoveSection removes a section from the root node. Does not recurse into children.
func (root *NavTreeRoot) RemoveSection(node *NavLink) {
	var result []*NavLink

	for _, child := range root.Children {
		if child != node {
			result = append(result, child)
		}
	}

	root.Children = result
}

// RemoveSectionByID removes a section by ID from the root node and all its children
func (root *NavTreeRoot) RemoveSectionByID(id string) bool {
	var result []*NavLink

	for i, child := range root.Children {
		if child.Id == id {
			// Remove the node by slicing it out
			result = append(root.Children[:i], root.Children[i+1:]...)
			root.Children = result
			return true
		} else if len(child.Children) > 0 {
			if removed := RemoveById(child, id); removed {
				return true
			}
		}
	}

	return false
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

func (root *NavTreeRoot) ApplyHelpVersion(version string) {
	helpNode := root.FindById("help")

	if helpNode != nil {
		helpNode.SubTitle = version
	}
}

func (root *NavTreeRoot) ApplyCostManagementIA() {
	orgAdminNode := root.FindById(NavIDCfg)
	var costManagementApp *NavLink
	var adaptiveMetricsApp *NavLink
	var adaptiveLogsApp *NavLink
	var adaptiveTracesApp *NavLink
	var attributionsApp *NavLink
	var logVolumeExplorerApp *NavLink

	if orgAdminNode != nil {
		adminNodeLinks := []*NavLink{}
		for _, element := range orgAdminNode.Children {
			switch navId := element.Id; navId {
			case "plugin-page-grafana-costmanagementui-app":
				costManagementApp = element
			case "plugin-page-grafana-adaptive-metrics-app":
				adaptiveMetricsApp = element
			case "plugin-page-grafana-adaptivelogs-app":
				adaptiveLogsApp = element
			case "plugin-page-grafana-adaptivetraces-app":
				adaptiveTracesApp = element
			case "plugin-page-grafana-attributions-app":
				attributionsApp = element
			case "plugin-page-grafana-logvolumeexplorer-app":
				logVolumeExplorerApp = element
			default:
				adminNodeLinks = append(adminNodeLinks, element)
			}
		}

		if costManagementApp != nil {
			costManagementMetricsNode := FindByURL(costManagementApp.Children, "/a/grafana-costmanagementui-app/metrics")
			if costManagementMetricsNode != nil {
				if adaptiveMetricsApp != nil {
					costManagementMetricsNode.Children = append(costManagementMetricsNode.Children, adaptiveMetricsApp)
				}
				if attributionsApp != nil {
					costManagementMetricsNode.Children = append(costManagementMetricsNode.Children, attributionsApp)
				}
			}

			costManagementLogsNode := FindByURL(costManagementApp.Children, "/a/grafana-costmanagementui-app/logs")
			if costManagementLogsNode != nil {
				if adaptiveLogsApp != nil {
					costManagementLogsNode.Children = append(costManagementLogsNode.Children, adaptiveLogsApp)
				}
				if logVolumeExplorerApp != nil {
					costManagementLogsNode.Children = append(costManagementLogsNode.Children, logVolumeExplorerApp)
				}
			}

			costManagementTracesNode := FindByURL(costManagementApp.Children, "/a/grafana-costmanagementui-app/traces")
			if costManagementTracesNode != nil {
				if adaptiveTracesApp != nil {
					costManagementTracesNode.Children = append(costManagementTracesNode.Children, adaptiveTracesApp)
				}
			}
			adminNodeLinks = append(adminNodeLinks, costManagementApp)
		}
		orgAdminNode.Children = adminNodeLinks
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

func RemoveById(node *NavLink, id string) bool {
	var result []*NavLink

	for i, child := range node.Children {
		if child.Id == id {
			// Remove the node by slicing it out
			result = append(node.Children[:i], node.Children[i+1:]...)
			node.Children = result
			return true
		} else if len(child.Children) > 0 {
			if removed := RemoveById(child, id); removed {
				return true
			}
		}
	}

	return false
}
