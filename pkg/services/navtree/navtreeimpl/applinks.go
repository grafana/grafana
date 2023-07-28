package navtreeimpl

import (
	"path"
	"sort"
	"strconv"

	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/util"
)

func (s *ServiceImpl) addAppLinks(treeRoot *navtree.NavTreeRoot, c *contextmodel.ReqContext) error {
	hasAccess := ac.HasAccess(s.accessControl, c)
	appLinks := []*navtree.NavLink{}

	pss, err := s.pluginSettings.GetPluginSettings(c.Req.Context(), &pluginsettings.GetArgs{OrgID: c.OrgID})
	if err != nil {
		return err
	}

	isPluginEnabled := func(plugin plugins.PluginDTO) bool {
		if plugin.AutoEnabled {
			return true
		}
		for _, ps := range pss {
			if ps.PluginID == plugin.ID {
				return ps.Enabled
			}
		}
		return false
	}

	for _, plugin := range s.pluginStore.Plugins(c.Req.Context(), plugins.TypeApp) {
		if !isPluginEnabled(plugin) {
			continue
		}

		if !hasAccess(ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, pluginaccesscontrol.ScopeProvider.GetResourceScope(plugin.ID))) {
			continue
		}

		if appNode := s.processAppPlugin(plugin, c, treeRoot); appNode != nil {
			appLinks = append(appLinks, appNode)
		}
	}

	if len(appLinks) > 0 {
		sort.SliceStable(appLinks, func(i, j int) bool {
			return appLinks[i].Text < appLinks[j].Text
		})
	}

	for _, appLink := range appLinks {
		treeRoot.AddSection(appLink)
	}

	return nil
}

func (s *ServiceImpl) processAppPlugin(plugin plugins.PluginDTO, c *contextmodel.ReqContext, treeRoot *navtree.NavTreeRoot) *navtree.NavLink {
	hasAccessToInclude := s.hasAccessToInclude(c, plugin.ID)
	appLink := &navtree.NavLink{
		Text:       plugin.Name,
		Id:         "plugin-page-" + plugin.ID,
		Img:        plugin.Info.Logos.Small,
		SubTitle:   plugin.Info.Description,
		SortWeight: navtree.WeightPlugin,
		IsSection:  true,
		PluginID:   plugin.ID,
		Url:        s.cfg.AppSubURL + "/a/" + plugin.ID,
	}

	for _, include := range plugin.Includes {
		if !hasAccessToInclude(include) {
			continue
		}

		if include.Type == "page" {
			link := &navtree.NavLink{
				Text:     include.Name,
				Icon:     include.Icon,
				PluginID: plugin.ID,
			}

			if len(include.Path) > 0 {
				link.Url = s.cfg.AppSubURL + include.Path
				if include.DefaultNav && include.AddToNav {
					appLink.Url = link.Url
				}
			} else {
				link.Url = s.cfg.AppSubURL + "/plugins/" + plugin.ID + "/page/" + include.Slug
			}

			// Register standalone plugin pages to certain sections using the Grafana config
			if pathConfig, ok := s.navigationAppPathConfig[include.Path]; ok {
				if sectionForPage := treeRoot.FindById(pathConfig.SectionID); sectionForPage != nil {
					link.Id = "standalone-plugin-page-" + include.Path
					link.SortWeight = pathConfig.SortWeight

					// Check if the section already has a page with the same URL, and in that case override it
					// (This only happens if it is explicitly set by `navigation.app_standalone_pages` in the INI config)
					isOverridingCorePage := false
					for _, child := range sectionForPage.Children {
						if child.Url == link.Url {
							child.Id = link.Id
							child.SortWeight = link.SortWeight
							child.PluginID = link.PluginID
							child.Children = []*navtree.NavLink{}
							isOverridingCorePage = true
							break
						}
					}

					// Append the page to the section
					if !isOverridingCorePage {
						sectionForPage.Children = append(sectionForPage.Children, link)
					}
				}

				// Register the page under the app
			} else if include.AddToNav {
				appLink.Children = append(appLink.Children, link)
			}
		}

		if include.Type == "dashboard" && include.AddToNav {
			dboardURL := include.DashboardURLPath()
			if dboardURL != "" {
				link := &navtree.NavLink{
					Url:      path.Join(s.cfg.AppSubURL, dboardURL),
					Text:     include.Name,
					PluginID: plugin.ID,
				}
				appLink.Children = append(appLink.Children, link)
			}
		}
	}

	// Apps without any nav children are not part of navtree
	if len(appLink.Children) == 0 {
		return nil
	}
	// If we only have one child and it's the app default nav then remove it from children
	if len(appLink.Children) == 1 && appLink.Children[0].Url == appLink.Url {
		appLink.Children = []*navtree.NavLink{}
	}

	// Remove default nav child
	childrenWithoutDefault := []*navtree.NavLink{}
	for _, child := range appLink.Children {
		if child.Url != appLink.Url {
			childrenWithoutDefault = append(childrenWithoutDefault, child)
		}
	}
	appLink.Children = childrenWithoutDefault

	s.addPluginToSection(c, treeRoot, plugin, appLink)

	return nil
}

func (s *ServiceImpl) addPluginToSection(c *contextmodel.ReqContext, treeRoot *navtree.NavTreeRoot, plugin plugins.PluginDTO, appLink *navtree.NavLink) {
	// Handle moving apps into specific navtree sections
	alertingNode := treeRoot.FindById(navtree.NavIDAlerting)
	if alertingNode == nil {
		// Search for legacy alerting node just in case
		alertingNode = treeRoot.FindById(navtree.NavIDAlertingLegacy)
	}
	sectionID := navtree.NavIDApps

	if navConfig, hasOverride := s.navigationAppConfig[plugin.ID]; hasOverride {
		appLink.SortWeight = navConfig.SortWeight
		sectionID = navConfig.SectionID

		if len(navConfig.Text) > 0 {
			appLink.Text = navConfig.Text
		}
		if len(navConfig.Icon) > 0 {
			appLink.Icon = navConfig.Icon
		}
	}

	if sectionID == navtree.NavIDRoot {
		treeRoot.AddSection(appLink)
	} else if navNode := treeRoot.FindById(sectionID); navNode != nil {
		navNode.Children = append(navNode.Children, appLink)
	} else {
		switch sectionID {
		case navtree.NavIDApps:
			treeRoot.AddSection(&navtree.NavLink{
				Text:       "Apps",
				Icon:       "layer-group",
				SubTitle:   "App plugins that extend the Grafana experience",
				Id:         navtree.NavIDApps,
				Children:   []*navtree.NavLink{appLink},
				SortWeight: navtree.WeightApps,
				Url:        s.cfg.AppSubURL + "/apps",
			})
		case navtree.NavIDMonitoring:
			treeRoot.AddSection(&navtree.NavLink{
				Text:       "Observability",
				Id:         navtree.NavIDMonitoring,
				SubTitle:   "Observability and infrastructure apps",
				Icon:       "heart-rate",
				SortWeight: navtree.WeightMonitoring,
				Children:   []*navtree.NavLink{appLink},
				Url:        s.cfg.AppSubURL + "/monitoring",
			})
		case navtree.NavIDAlertsAndIncidents:
			alertsAndIncidentsChildren := []*navtree.NavLink{}
			if alertingNode != nil {
				alertsAndIncidentsChildren = append(alertsAndIncidentsChildren, alertingNode)
				treeRoot.RemoveSection(alertingNode)
			}
			alertsAndIncidentsChildren = append(alertsAndIncidentsChildren, appLink)
			treeRoot.AddSection(&navtree.NavLink{
				Text:       "Alerts & IRM",
				Id:         navtree.NavIDAlertsAndIncidents,
				SubTitle:   "Alerting and incident management apps",
				Icon:       "bell",
				SortWeight: navtree.WeightAlertsAndIncidents,
				Children:   alertsAndIncidentsChildren,
				Url:        s.cfg.AppSubURL + "/alerts-and-incidents",
			})
		default:
			s.log.Error("Plugin app nav id not found", "pluginId", plugin.ID, "navId", sectionID)
		}
	}
}

func (s *ServiceImpl) hasAccessToInclude(c *contextmodel.ReqContext, pluginID string) func(include *plugins.Includes) bool {
	hasAccess := ac.HasAccess(s.accessControl, c)
	return func(include *plugins.Includes) bool {
		useRBAC := s.features.IsEnabled(featuremgmt.FlagAccessControlOnCall) && include.RequiresRBACAction()
		if useRBAC && !hasAccess(ac.EvalPermission(include.Action)) {
			s.log.Debug("plugin include is covered by RBAC, user doesn't have access",
				"plugin", pluginID,
				"include", include.Name)
			return false
		} else if !useRBAC && !c.HasUserRole(include.Role) {
			return false
		}
		return true
	}
}

func (s *ServiceImpl) readNavigationSettings() {
	s.navigationAppConfig = map[string]NavigationAppConfig{
		"grafana-k8s-app":                  {SectionID: navtree.NavIDMonitoring, SortWeight: 1, Text: "Kubernetes"},
		"grafana-app-observability-app":    {SectionID: navtree.NavIDMonitoring, SortWeight: 2, Text: "Application (preview)"},
		"grafana-pyroscope-app":            {SectionID: navtree.NavIDMonitoring, SortWeight: 3, Text: "Profiles (preview)"},
		"grafana-kowalski-app":             {SectionID: navtree.NavIDMonitoring, SortWeight: 4, Text: "Frontend"},
		"grafana-synthetic-monitoring-app": {SectionID: navtree.NavIDMonitoring, SortWeight: 5, Text: "Synthetics"},
		"grafana-oncall-app":               {SectionID: navtree.NavIDAlertsAndIncidents, SortWeight: 1, Text: "OnCall"},
		"grafana-incident-app":             {SectionID: navtree.NavIDAlertsAndIncidents, SortWeight: 2, Text: "Incidents"},
		"grafana-ml-app":                   {SectionID: navtree.NavIDAlertsAndIncidents, SortWeight: 3, Text: "Machine Learning"},
		"grafana-cloud-link-app":           {SectionID: navtree.NavIDCfg},
		"grafana-easystart-app":            {SectionID: navtree.NavIDRoot, SortWeight: navtree.WeightApps + 1, Text: "Connections", Icon: "adjust-circle"},
		"k6-app":                           {SectionID: navtree.NavIDRoot, SortWeight: navtree.WeightAlertsAndIncidents + 1, Text: "Performance testing", Icon: "k6"},
	}

	s.navigationAppPathConfig = map[string]NavigationAppConfig{
		"/a/grafana-auth-app": {SectionID: navtree.NavIDCfg, SortWeight: 7},
	}

	appSections := s.cfg.Raw.Section("navigation.app_sections")
	appStandalonePages := s.cfg.Raw.Section("navigation.app_standalone_pages")

	for _, key := range appSections.Keys() {
		pluginId := key.Name()
		// Support <id> <weight> value
		values := util.SplitString(appSections.Key(key.Name()).MustString(""))

		appCfg := &NavigationAppConfig{SectionID: values[0]}
		if len(values) > 1 {
			if weight, err := strconv.ParseInt(values[1], 10, 64); err == nil {
				appCfg.SortWeight = weight
			}
		}

		// Only apply the new values, don't completely overwrite the entry if it exists
		if entry, ok := s.navigationAppConfig[pluginId]; ok {
			entry.SectionID = appCfg.SectionID
			if appCfg.SortWeight != 0 {
				entry.SortWeight = appCfg.SortWeight
			}
			s.navigationAppConfig[pluginId] = entry
		} else {
			s.navigationAppConfig[pluginId] = *appCfg
		}
	}

	for _, key := range appStandalonePages.Keys() {
		url := key.Name()
		// Support <id> <weight> value
		values := util.SplitString(appStandalonePages.Key(key.Name()).MustString(""))

		appCfg := &NavigationAppConfig{SectionID: values[0]}
		if len(values) > 1 {
			if weight, err := strconv.ParseInt(values[1], 10, 64); err == nil {
				appCfg.SortWeight = weight
			}
		}

		s.navigationAppPathConfig[url] = *appCfg
	}
}
