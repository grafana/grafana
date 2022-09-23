package navtreeimpl

import (
	"path"
	"sort"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
)

func (s *ServiceImpl) getAppLinks(c *models.ReqContext) ([]*navtree.NavLink, error) {
	hasAccess := ac.HasAccess(s.accessControl, c)
	appLinks := []*navtree.NavLink{}

	pss, err := s.pluginSettings.GetPluginSettings(c.Req.Context(), &pluginsettings.GetArgs{OrgID: c.OrgID})
	if err != nil {
		return nil, err
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

		appLink := &navtree.NavLink{
			Text:       plugin.Name,
			Id:         "plugin-page-" + plugin.ID,
			Img:        plugin.Info.Logos.Small,
			Section:    navtree.NavSectionPlugin,
			SortWeight: navtree.WeightPlugin,
		}

		if s.features.IsEnabled(featuremgmt.FlagTopnav) {
			appLink.Url = s.cfg.AppSubURL + "/a/" + plugin.ID
		} else {
			appLink.Url = path.Join(s.cfg.AppSubURL, plugin.DefaultNavURL)
		}

		for _, include := range plugin.Includes {
			if !c.HasUserRole(include.Role) {
				continue
			}

			if include.Type == "page" && include.AddToNav {
				var link *navtree.NavLink
				if len(include.Path) > 0 {
					link = &navtree.NavLink{
						Url:  s.cfg.AppSubURL + include.Path,
						Text: include.Name,
					}
					if include.DefaultNav && !s.features.IsEnabled(featuremgmt.FlagTopnav) {
						appLink.Url = link.Url // Overwrite the hardcoded page logic
					}
				} else {
					link = &navtree.NavLink{
						Url:  s.cfg.AppSubURL + "/plugins/" + plugin.ID + "/page/" + include.Slug,
						Text: include.Name,
					}
				}
				link.Icon = include.Icon
				appLink.Children = append(appLink.Children, link)
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
			appLinks = append(appLinks, appLink)
		}
	}

	if len(appLinks) > 0 {
		sort.SliceStable(appLinks, func(i, j int) bool {
			return appLinks[i].Text < appLinks[j].Text
		})
	}

	return appLinks, nil
}
