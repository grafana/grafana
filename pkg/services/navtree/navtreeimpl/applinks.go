package navtreeimpl

import (
	"path"
	"sort"
	"strconv"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/util"
)

func (s *ServiceImpl) addAppLinks(treeRoot *navtree.NavTreeRoot, c *models.ReqContext) error {
	topNavEnabled := s.features.IsEnabled(featuremgmt.FlagTopnav)
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

	for _, plugin := range s.pluginStore.Plugins(c.Req.Context(), plugins.App) {
		if !isPluginEnabled(plugin) {
			continue
		}

		if !hasAccess(ac.ReqSignedIn,
			ac.EvalPermission(plugins.ActionAppAccess, plugins.ScopeProvider.GetResourceScope(plugin.ID))) {
			continue
		}

		if appNode := s.processAppPlugin(plugin, c, topNavEnabled, treeRoot); appNode != nil {
			appLinks = append(appLinks, appNode)
		}
	}

	if len(appLinks) > 0 {
		sort.SliceStable(appLinks, func(i, j int) bool {
			return appLinks[i].Text < appLinks[j].Text
		})
	}

	if topNavEnabled {
		treeRoot.AddSection(&navtree.NavLink{
			Text:     "Apps",
			Icon:     "apps",
			SubTitle: "App plugins that extend the Grafana experience",
			Id:       "apps",
			Children: appLinks,
			Section:  navtree.NavSectionCore,
			Url:      s.cfg.AppSubURL + "/apps",
		})
	} else {
		for _, appLink := range appLinks {
			treeRoot.AddSection(appLink)
		}
	}

	return nil
}

func (s *ServiceImpl) processAppPlugin(plugin plugins.PluginDTO, c *models.ReqContext, topNavEnabled bool, treeRoot *navtree.NavTreeRoot) *navtree.NavLink {
	appLink := &navtree.NavLink{
		Text:       plugin.Name,
		Id:         "plugin-page-" + plugin.ID,
		Img:        plugin.Info.Logos.Small,
		Section:    navtree.NavSectionPlugin,
		SortWeight: navtree.WeightPlugin,
	}

	if topNavEnabled {
		appLink.Url = s.cfg.AppSubURL + "/a/" + plugin.ID
	} else {
		appLink.Url = path.Join(s.cfg.AppSubURL, plugin.DefaultNavURL)
	}

	for _, include := range plugin.Includes {
		if !c.HasUserRole(include.Role) {
			continue
		}

		if include.Type == "page" && include.AddToNav {
			link := &navtree.NavLink{
				Text: include.Name,
				Icon: include.Icon,
			}

			if len(include.Path) > 0 {
				link.Url = s.cfg.AppSubURL + include.Path
				if include.DefaultNav {
					appLink.Url = link.Url
				}
			} else {
				link.Url = s.cfg.AppSubURL + "/plugins/" + plugin.ID + "/page/" + include.Slug
			}

			if pathConfig, ok := s.navigationAppPathConfig[include.Path]; ok {
				if sectionForPage := treeRoot.FindById(pathConfig.SectionID); sectionForPage != nil {
					link.Id = "standalone-plugin-page-" + include.Path
					link.SortWeight = pathConfig.SortWeight
					sectionForPage.Children = append(sectionForPage.Children, link)
				}
			} else {
				appLink.Children = append(appLink.Children, link)
			}
		}

		if include.Type == "dashboard" && include.AddToNav {
			dboardURL := include.DashboardURLPath()
			if dboardURL != "" {
				link := &navtree.NavLink{
					Url:  path.Join(s.cfg.AppSubURL, dboardURL),
					Text: include.Name,
				}
				appLink.Children = append(appLink.Children, link)
			}
		}
	}

	if len(appLink.Children) > 0 {
		// If we only have one child and it's the app default nav then remove it from children
		if len(appLink.Children) == 1 && appLink.Children[0].Url == appLink.Url {
			appLink.Children = []*navtree.NavLink{}
		}

		alertingNode := treeRoot.FindById(navtree.NavIDAlerting)

		if navConfig, hasOverride := s.navigationAppConfig[plugin.ID]; hasOverride && topNavEnabled {
			appLink.SortWeight = navConfig.SortWeight

			if navNode := treeRoot.FindById(navConfig.SectionID); navNode != nil {
				navNode.Children = append(navNode.Children, appLink)
			} else {
				if navConfig.SectionID == navtree.NavIDMonitoring {
					treeRoot.AddSection(&navtree.NavLink{
						Text:     "Monitoring",
						Id:       navtree.NavIDMonitoring,
						SubTitle: "Monitoring and infrastructure apps",
						Icon:     "heart-rate",
						Section:  navtree.NavSectionCore,
						Children: []*navtree.NavLink{appLink},
						Url:      s.cfg.AppSubURL + "/monitoring",
					})
				} else if navConfig.SectionID == navtree.NavIDAlertsAndIncidents && alertingNode != nil {
					treeRoot.AddSection(&navtree.NavLink{
						Text:     "Alerts & incidents",
						Id:       navtree.NavIDAlertsAndIncidents,
						SubTitle: "Alerting and incident management apps",
						Icon:     "bell",
						Section:  navtree.NavSectionCore,
						Children: []*navtree.NavLink{alertingNode, appLink},
						Url:      s.cfg.AppSubURL + "/alerts-and-incidents",
					})
					treeRoot.RemoveSection(alertingNode)
				} else {
					s.log.Error("Plugin app nav id not found", "pluginId", plugin.ID, "navId", navConfig.SectionID)
				}
			}
		} else {
			return appLink
		}
	}

	return nil
}

func (s *ServiceImpl) readNavigationSettings() {
	s.navigationAppConfig = map[string]NavigationAppConfig{
		"grafana-k8s-app":                  {SectionID: navtree.NavIDMonitoring, SortWeight: 1},
		"grafana-synthetic-monitoring-app": {SectionID: navtree.NavIDMonitoring, SortWeight: 2},
		"grafana-oncall-app":               {SectionID: navtree.NavIDAlertsAndIncidents, SortWeight: 1},
		"grafana-incident-app":             {SectionID: navtree.NavIDAlertsAndIncidents, SortWeight: 2},
		"grafana-ml-app":                   {SectionID: navtree.NavIDAlertsAndIncidents, SortWeight: 3},
	}

	s.navigationAppPathConfig = map[string]NavigationAppConfig{
		"/a/grafana-auth-app": {SectionID: navtree.NavIDCfg, SortWeight: 7},
	}

	sec := s.cfg.Raw.Section("navigation.apps")

	for _, key := range sec.Keys() {
		pluginId := key.Name()
		// Support <id> <weight> value
		values := util.SplitString(sec.Key(key.Name()).MustString(""))

		appCfg := &NavigationAppConfig{SectionID: values[0]}
		if len(values) > 1 {
			if weight, err := strconv.ParseInt(values[1], 10, 64); err == nil {
				appCfg.SortWeight = weight
			}
		}

		s.navigationAppConfig[pluginId] = *appCfg
	}
}
