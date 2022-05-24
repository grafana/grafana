package api

import (
	"fmt"
	"net/http"
	"path"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/navlinks"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// Themes
	lightName = "light"
	darkName  = "dark"
)

func (hs *HTTPServer) getProfileNode(c *models.ReqContext) *dtos.NavLink {
	// Only set login if it's different from the name
	var login string
	if c.SignedInUser.Login != c.SignedInUser.NameOrFallback() {
		login = c.SignedInUser.Login
	}
	gravatarURL := dtos.GetGravatarUrl(c.Email)

	children := []*dtos.NavLink{
		{
			Text: "Preferences", Id: "profile-settings", Url: hs.Cfg.AppSubURL + "/profile", Icon: "sliders-v-alt",
		},
	}

	if hs.Features.IsEnabled(featuremgmt.FlagPersistNotifications) {
		children = append(children, &dtos.NavLink{
			Text: "Notification history", Id: "notifications", Url: hs.Cfg.AppSubURL + "/notifications", Icon: "bell",
		})
	}

	if setting.AddChangePasswordLink() {
		children = append(children, &dtos.NavLink{
			Text: "Change password", Id: "change-password", Url: hs.Cfg.AppSubURL + "/profile/password",
			Icon: "lock",
		})
	}

	if !setting.DisableSignoutMenu {
		// add sign out first
		children = append(children, &dtos.NavLink{
			Text:         "Sign out",
			Id:           "sign-out",
			Url:          hs.Cfg.AppSubURL + "/logout",
			Icon:         "arrow-from-right",
			Target:       "_self",
			HideFromTabs: true,
		})
	}

	return &dtos.NavLink{
		Text:       c.SignedInUser.NameOrFallback(),
		SubTitle:   login,
		Id:         "profile",
		Img:        gravatarURL,
		Url:        hs.Cfg.AppSubURL + "/profile",
		Section:    dtos.NavSectionConfig,
		SortWeight: dtos.WeightProfile,
		Children:   children,
	}
}

func (hs *HTTPServer) getAppLinks(c *models.ReqContext) ([]*dtos.NavLink, error) {
	enabledPlugins, err := hs.enabledPlugins(c.Req.Context(), c.OrgId)
	if err != nil {
		return nil, err
	}

	appLinks := []*dtos.NavLink{}
	for _, plugin := range enabledPlugins[plugins.App] {
		if !plugin.Pinned {
			continue
		}

		appLink := &dtos.NavLink{
			Text:       plugin.Name,
			Id:         "plugin-page-" + plugin.ID,
			Url:        path.Join(hs.Cfg.AppSubURL, plugin.DefaultNavURL),
			Img:        plugin.Info.Logos.Small,
			SortWeight: dtos.WeightPlugin,
		}

		if hs.Features.IsEnabled(featuremgmt.FlagNewNavigation) {
			appLink.Section = dtos.NavSectionPlugin
		} else {
			appLink.Section = dtos.NavSectionCore
		}

		for _, include := range plugin.Includes {
			if !c.HasUserRole(include.Role) {
				continue
			}

			if include.Type == "page" && include.AddToNav {
				var link *dtos.NavLink
				if len(include.Path) > 0 {
					link = &dtos.NavLink{
						Url:  hs.Cfg.AppSubURL + include.Path,
						Text: include.Name,
					}
					if include.DefaultNav {
						appLink.Url = link.Url // Overwrite the hardcoded page logic
					}
				} else {
					link = &dtos.NavLink{
						Url:  hs.Cfg.AppSubURL + "/plugins/" + plugin.ID + "/page/" + include.Slug,
						Text: include.Name,
					}
				}
				link.Icon = include.Icon
				appLink.Children = append(appLink.Children, link)
			}

			if include.Type == "dashboard" && include.AddToNav {
				dboardURL := include.DashboardURLPath()
				if dboardURL != "" {
					link := &dtos.NavLink{
						Url:  path.Join(hs.Cfg.AppSubURL, dboardURL),
						Text: include.Name,
					}
					appLink.Children = append(appLink.Children, link)
				}
			}
		}

		if len(appLink.Children) > 0 {
			// If we only have one child and it's the app default nav then remove it from children
			if len(appLink.Children) == 1 && appLink.Children[0].Url == appLink.Url {
				appLink.Children = []*dtos.NavLink{}
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

func enableServiceAccount(hs *HTTPServer, c *models.ReqContext) bool {
	if !hs.Features.IsEnabled(featuremgmt.FlagServiceAccounts) {
		return false
	}
	hasAccess := ac.HasAccess(hs.AccessControl, c)
	return hasAccess(ac.ReqOrgAdmin, serviceAccountAccessEvaluator)
}

func (hs *HTTPServer) ReqCanAdminTeams(c *models.ReqContext) bool {
	return c.OrgRole == models.ROLE_ADMIN || (hs.Cfg.EditorsCanAdmin && c.OrgRole == models.ROLE_EDITOR)
}

func (hs *HTTPServer) getNavTree(c *models.ReqContext, hasEditPerm bool, prefs *pref.Preference) ([]*dtos.NavLink, error) {
	hasAccess := ac.HasAccess(hs.AccessControl, c)
	navTree := []*dtos.NavLink{}

	if hs.Features.IsEnabled(featuremgmt.FlagSavedItems) {
		starredItemsLinks, err := hs.buildStarredItemsNavLinks(c, prefs)
		if err != nil {
			return nil, err
		}

		navTree = append(navTree, &dtos.NavLink{
			Text:       "Starred",
			Id:         "starred",
			Icon:       "star",
			SortWeight: dtos.WeightSavedItems,
			Section:    dtos.NavSectionCore,
			Children:   starredItemsLinks,
		})
	}

	if hasEditPerm && !hs.Features.IsEnabled(featuremgmt.FlagNewNavigation) {
		children := hs.buildCreateNavLinks(c)
		navTree = append(navTree, &dtos.NavLink{
			Text:       "Create",
			Id:         "create",
			Icon:       "plus",
			Url:        hs.Cfg.AppSubURL + "/dashboard/new",
			Children:   children,
			Section:    dtos.NavSectionCore,
			SortWeight: dtos.WeightCreate,
		})
	}

	dashboardChildLinks := hs.buildDashboardNavLinks(c, hasEditPerm)

	dashboardsUrl := "/"
	if hs.Features.IsEnabled(featuremgmt.FlagNewNavigation) {
		dashboardsUrl = "/dashboards"
	}

	navTree = append(navTree, &dtos.NavLink{
		Text:       "Dashboards",
		Id:         "dashboards",
		SubTitle:   "Manage dashboards and folders",
		Icon:       "apps",
		Url:        hs.Cfg.AppSubURL + dashboardsUrl,
		SortWeight: dtos.WeightDashboard,
		Section:    dtos.NavSectionCore,
		Children:   dashboardChildLinks,
	})

	canExplore := func(context *models.ReqContext) bool {
		return c.OrgRole == models.ROLE_ADMIN || c.OrgRole == models.ROLE_EDITOR || setting.ViewersCanEdit
	}

	if setting.ExploreEnabled && hasAccess(canExplore, ac.EvalPermission(ac.ActionDatasourcesExplore)) {
		navTree = append(navTree, &dtos.NavLink{
			Text:       "Explore",
			Id:         "explore",
			SubTitle:   "Explore your data",
			Icon:       "compass",
			SortWeight: dtos.WeightExplore,
			Section:    dtos.NavSectionCore,
			Url:        hs.Cfg.AppSubURL + "/explore",
		})
	}

	navTree = hs.addProfile(navTree, c)

	_, uaIsDisabledForOrg := hs.Cfg.UnifiedAlerting.DisabledOrgs[c.OrgId]
	uaVisibleForOrg := hs.Cfg.UnifiedAlerting.IsEnabled() && !uaIsDisabledForOrg

	if setting.AlertingEnabled != nil && *setting.AlertingEnabled {
		navTree = append(navTree, hs.buildLegacyAlertNavLinks()...)
	} else if uaVisibleForOrg {
		navTree = append(navTree, hs.buildAlertNavLinks(c)...)
	}

	appLinks, err := hs.getAppLinks(c)
	if err != nil {
		return nil, err
	}
	navTree = append(navTree, appLinks...)

	configNodes := []*dtos.NavLink{}

	if hasAccess(ac.ReqOrgAdmin, datasources.ConfigurationPageAccess) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Data sources",
			Icon:        "database",
			Description: "Add and configure data sources",
			Id:          "datasources",
			Url:         hs.Cfg.AppSubURL + "/datasources",
		})
	}

	if hasAccess(ac.ReqOrgAdmin, ac.EvalPermission(ac.ActionOrgUsersRead)) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Users",
			Id:          "users",
			Description: "Manage org members",
			Icon:        "user",
			Url:         hs.Cfg.AppSubURL + "/org/users",
		})
	}

	if hasAccess(hs.ReqCanAdminTeams, teamsAccessEvaluator) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Teams",
			Id:          "teams",
			Description: "Manage org groups",
			Icon:        "users-alt",
			Url:         hs.Cfg.AppSubURL + "/org/teams",
		})
	}

	if c.OrgRole == models.ROLE_ADMIN {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Plugins",
			Id:          "plugins",
			Description: "View and configure plugins",
			Icon:        "plug",
			Url:         hs.Cfg.AppSubURL + "/plugins",
		})
	}

	if hasAccess(ac.ReqOrgAdmin, orgPreferencesAccessEvaluator) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Preferences",
			Id:          "org-settings",
			Description: "Organization preferences",
			Icon:        "sliders-v-alt",
			Url:         hs.Cfg.AppSubURL + "/org",
		})
	}

	if hasAccess(ac.ReqOrgAdmin, apiKeyAccessEvaluator) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "API keys",
			Id:          "apikeys",
			Description: "Create & manage API keys",
			Icon:        "key-skeleton-alt",
			Url:         hs.Cfg.AppSubURL + "/org/apikeys",
		})
	}
	// needs both feature flag and migration to be able to show service accounts
	if enableServiceAccount(hs, c) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Service accounts",
			Id:          "serviceaccounts",
			Description: "Manage service accounts",
			// TODO: change icon to "key-skeleton-alt" when it's available
			Icon: "keyhole-circle",
			Url:  hs.Cfg.AppSubURL + "/org/serviceaccounts",
		})
	}

	if hs.Features.IsEnabled(featuremgmt.FlagLivePipeline) {
		liveNavLinks := []*dtos.NavLink{}

		liveNavLinks = append(liveNavLinks, &dtos.NavLink{
			Text: "Status", Id: "live-status", Url: hs.Cfg.AppSubURL + "/live", Icon: "exchange-alt",
		})
		liveNavLinks = append(liveNavLinks, &dtos.NavLink{
			Text: "Pipeline", Id: "live-pipeline", Url: hs.Cfg.AppSubURL + "/live/pipeline", Icon: "arrow-to-right",
		})
		liveNavLinks = append(liveNavLinks, &dtos.NavLink{
			Text: "Cloud", Id: "live-cloud", Url: hs.Cfg.AppSubURL + "/live/cloud", Icon: "cloud-upload",
		})
		navTree = append(navTree, &dtos.NavLink{
			Id:           "live",
			Text:         "Live",
			SubTitle:     "Event streaming",
			Icon:         "exchange-alt",
			Url:          hs.Cfg.AppSubURL + "/live",
			Children:     liveNavLinks,
			Section:      dtos.NavSectionConfig,
			HideFromTabs: true,
		})
	}

	if len(configNodes) > 0 {
		configNode := &dtos.NavLink{
			Id:         dtos.NavIDCfg,
			Text:       "Configuration",
			SubTitle:   "Organization: " + c.OrgName,
			Icon:       "cog",
			Url:        configNodes[0].Url,
			SortWeight: dtos.WeightConfig,
			Children:   configNodes,
		}
		if hs.Features.IsEnabled(featuremgmt.FlagNewNavigation) {
			configNode.Section = dtos.NavSectionConfig
		} else {
			configNode.Section = dtos.NavSectionCore
		}
		navTree = append(navTree, configNode)
	}

	adminNavLinks := hs.buildAdminNavLinks(c)

	if len(adminNavLinks) > 0 {
		navSection := dtos.NavSectionCore
		if hs.Features.IsEnabled(featuremgmt.FlagNewNavigation) {
			navSection = dtos.NavSectionConfig
		}
		serverAdminNode := navlinks.GetServerAdminNode(adminNavLinks, navSection)
		navTree = append(navTree, serverAdminNode)
	}

	navTree = hs.addHelpLinks(navTree, c)

	return navTree, nil
}

func (hs *HTTPServer) addProfile(navTree []*dtos.NavLink, c *models.ReqContext) []*dtos.NavLink {
	if setting.ProfileEnabled && c.IsSignedIn {
		navTree = append(navTree, hs.getProfileNode(c))
	}
	return navTree
}

func (hs *HTTPServer) addHelpLinks(navTree []*dtos.NavLink, c *models.ReqContext) []*dtos.NavLink {
	if setting.HelpEnabled {
		helpVersion := fmt.Sprintf(`%s v%s (%s)`, setting.ApplicationName, setting.BuildVersion, setting.BuildCommit)
		if hs.Cfg.AnonymousHideVersion && !c.IsSignedIn {
			helpVersion = setting.ApplicationName
		}

		navTree = append(navTree, &dtos.NavLink{
			Text:       "Help",
			SubTitle:   helpVersion,
			Id:         "help",
			Url:        "#",
			Icon:       "question-circle",
			SortWeight: dtos.WeightHelp,
			Section:    dtos.NavSectionConfig,
			Children:   []*dtos.NavLink{},
		})
	}
	return navTree
}

func (hs *HTTPServer) buildStarredItemsNavLinks(c *models.ReqContext, prefs *pref.Preference) ([]*dtos.NavLink, error) {
	starredItemsChildNavs := []*dtos.NavLink{}

	query := star.GetUserStarsQuery{
		UserID: c.SignedInUser.UserId,
	}

	starredDashboardResult, err := hs.starService.GetByUser(c.Req.Context(), &query)
	if err != nil {
		return nil, err
	}

	starredDashboards := []*models.Dashboard{}
	starredDashboardsCounter := 0
	for dashboardId := range starredDashboardResult.UserStars {
		// Set a loose limit to the first 50 starred dashboards found
		if starredDashboardsCounter > 50 {
			break
		}
		starredDashboardsCounter++
		query := &models.GetDashboardQuery{
			Id:    dashboardId,
			OrgId: c.OrgId,
		}
		err := hs.dashboardService.GetDashboard(c.Req.Context(), query)
		if err == nil {
			starredDashboards = append(starredDashboards, query.Result)
		}
	}

	if len(starredDashboards) > 0 {
		sort.Slice(starredDashboards, func(i, j int) bool {
			return starredDashboards[i].Title < starredDashboards[j].Title
		})
		for _, starredItem := range starredDashboards {
			starredItemsChildNavs = append(starredItemsChildNavs, &dtos.NavLink{
				Id:   starredItem.Uid,
				Text: starredItem.Title,
				Url:  starredItem.GetUrl(),
			})
		}
	}

	return starredItemsChildNavs, nil
}

func (hs *HTTPServer) buildDashboardNavLinks(c *models.ReqContext, hasEditPerm bool) []*dtos.NavLink {
	dashboardChildNavs := []*dtos.NavLink{}
	if !hs.Features.IsEnabled(featuremgmt.FlagNewNavigation) {
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "Home", Id: "home", Url: hs.Cfg.AppSubURL + "/", Icon: "home-alt", HideFromTabs: true,
		})
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "Divider", Divider: true, Id: "divider", HideFromTabs: true,
		})
	}
	dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
		Text: "Browse", Id: "manage-dashboards", Url: hs.Cfg.AppSubURL + "/dashboards", Icon: "sitemap",
	})
	dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
		Text: "Playlists", Id: "playlists", Url: hs.Cfg.AppSubURL + "/playlists", Icon: "presentation-play",
	})

	if c.IsSignedIn {
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "Snapshots",
			Id:   "snapshots",
			Url:  hs.Cfg.AppSubURL + "/dashboard/snapshots",
			Icon: "camera",
		})

		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "Library panels",
			Id:   "library-panels",
			Url:  hs.Cfg.AppSubURL + "/library-panels",
			Icon: "library-panel",
		})
	}

	if hasEditPerm && hs.Features.IsEnabled(featuremgmt.FlagNewNavigation) {
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "Divider", Divider: true, Id: "divider", HideFromTabs: true,
		})
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "New dashboard", Icon: "plus", Url: hs.Cfg.AppSubURL + "/dashboard/new", HideFromTabs: true, Id: "new-dashboard", ShowIconInNavbar: true,
		})
		if c.OrgRole == models.ROLE_ADMIN || c.OrgRole == models.ROLE_EDITOR {
			dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
				Text: "New folder", SubTitle: "Create a new folder to organize your dashboards", Id: "new-folder",
				Icon: "plus", Url: hs.Cfg.AppSubURL + "/dashboards/folder/new", HideFromTabs: true, ShowIconInNavbar: true,
			})
		}
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "Import", SubTitle: "Import dashboard from file or Grafana.com", Id: "import", Icon: "plus",
			Url: hs.Cfg.AppSubURL + "/dashboard/import", HideFromTabs: true, ShowIconInNavbar: true,
		})
	}
	return dashboardChildNavs
}

func (hs *HTTPServer) buildLegacyAlertNavLinks() []*dtos.NavLink {
	var alertChildNavs []*dtos.NavLink
	alertChildNavs = append(alertChildNavs, &dtos.NavLink{
		Text: "Alert rules", Id: "alert-list", Url: hs.Cfg.AppSubURL + "/alerting/list", Icon: "list-ul",
	})
	alertChildNavs = append(alertChildNavs, &dtos.NavLink{
		Text: "Notification channels", Id: "channels", Url: hs.Cfg.AppSubURL + "/alerting/notifications",
		Icon: "comment-alt-share",
	})

	return []*dtos.NavLink{
		{
			Text:       "Alerting",
			SubTitle:   "Alert rules and notifications",
			Id:         "alerting",
			Icon:       "bell",
			Url:        hs.Cfg.AppSubURL + "/alerting/list",
			Children:   alertChildNavs,
			Section:    dtos.NavSectionCore,
			SortWeight: dtos.WeightAlerting,
		},
	}
}

func (hs *HTTPServer) buildAlertNavLinks(c *models.ReqContext) []*dtos.NavLink {
	hasAccess := ac.HasAccess(hs.AccessControl, c)
	var alertChildNavs []*dtos.NavLink

	if hasAccess(ac.ReqViewer, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingRuleRead), ac.EvalPermission(ac.ActionAlertingRuleExternalRead))) {
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{
			Text: "Alert rules", Id: "alert-list", Url: hs.Cfg.AppSubURL + "/alerting/list", Icon: "list-ul",
		})
	}

	if hasAccess(ac.ReqOrgAdminOrEditor, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingNotificationsRead), ac.EvalPermission(ac.ActionAlertingNotificationsExternalRead))) {
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{
			Text: "Contact points", Id: "receivers", Url: hs.Cfg.AppSubURL + "/alerting/notifications",
			Icon: "comment-alt-share",
		})
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{Text: "Notification policies", Id: "am-routes", Url: hs.Cfg.AppSubURL + "/alerting/routes", Icon: "sitemap"})
	}

	if hasAccess(ac.ReqViewer, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingInstanceRead), ac.EvalPermission(ac.ActionAlertingInstancesExternalRead))) {
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{Text: "Silences", Id: "silences", Url: hs.Cfg.AppSubURL + "/alerting/silences", Icon: "bell-slash"})
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{Text: "Alert groups", Id: "groups", Url: hs.Cfg.AppSubURL + "/alerting/groups", Icon: "layer-group"})
	}

	if c.OrgRole == models.ROLE_ADMIN {
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{
			Text: "Admin", Id: "alerting-admin", Url: hs.Cfg.AppSubURL + "/alerting/admin",
			Icon: "cog",
		})
	}

	if hs.Features.IsEnabled(featuremgmt.FlagNewNavigation) &&
		hasAccess(hs.editorInAnyFolder, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingRuleCreate), ac.EvalPermission(ac.ActionAlertingRuleExternalWrite))) {
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{
			Text: "Divider", Divider: true, Id: "divider", HideFromTabs: true,
		})

		alertChildNavs = append(alertChildNavs, &dtos.NavLink{
			Text: "New alert rule", SubTitle: "Create an alert rule", Id: "alert",
			Icon: "plus", Url: hs.Cfg.AppSubURL + "/alerting/new", HideFromTabs: true, ShowIconInNavbar: true,
		})
	}

	if len(alertChildNavs) > 0 {
		return []*dtos.NavLink{
			{
				Text:       "Alerting",
				SubTitle:   "Alert rules and notifications",
				Id:         "alerting",
				Icon:       "bell",
				Url:        hs.Cfg.AppSubURL + "/alerting/list",
				Children:   alertChildNavs,
				Section:    dtos.NavSectionCore,
				SortWeight: dtos.WeightAlerting,
			},
		}
	}
	return nil
}

func (hs *HTTPServer) buildCreateNavLinks(c *models.ReqContext) []*dtos.NavLink {
	hasAccess := ac.HasAccess(hs.AccessControl, c)
	var children []*dtos.NavLink

	if hasAccess(ac.ReqSignedIn, ac.EvalPermission(dashboards.ActionDashboardsCreate)) {
		children = append(children, &dtos.NavLink{Text: "Dashboard", Icon: "apps", Url: hs.Cfg.AppSubURL + "/dashboard/new", Id: "create-dashboard"})
	}

	if hasAccess(ac.ReqOrgAdminOrEditor, ac.EvalPermission(dashboards.ActionFoldersCreate)) {
		children = append(children, &dtos.NavLink{
			Text: "Folder", SubTitle: "Create a new folder to organize your dashboards", Id: "folder",
			Icon: "folder-plus", Url: hs.Cfg.AppSubURL + "/dashboards/folder/new",
		})
	}

	if hasAccess(ac.ReqSignedIn, ac.EvalPermission(dashboards.ActionDashboardsCreate)) {
		children = append(children, &dtos.NavLink{
			Text: "Import", SubTitle: "Import dashboard from file or Grafana.com", Id: "import", Icon: "import",
			Url: hs.Cfg.AppSubURL + "/dashboard/import",
		})
	}

	_, uaIsDisabledForOrg := hs.Cfg.UnifiedAlerting.DisabledOrgs[c.OrgId]
	uaVisibleForOrg := hs.Cfg.UnifiedAlerting.IsEnabled() && !uaIsDisabledForOrg

	if uaVisibleForOrg && hasAccess(ac.ReqSignedIn, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingRuleCreate), ac.EvalPermission(ac.ActionAlertingRuleExternalWrite))) {
		children = append(children, &dtos.NavLink{
			Text: "New alert rule", SubTitle: "Create an alert rule", Id: "alert",
			Icon: "bell", Url: hs.Cfg.AppSubURL + "/alerting/new",
		})
	}

	return children
}

func (hs *HTTPServer) buildAdminNavLinks(c *models.ReqContext) []*dtos.NavLink {
	hasAccess := ac.HasAccess(hs.AccessControl, c)
	hasGlobalAccess := ac.HasGlobalAccess(hs.AccessControl, c)
	adminNavLinks := []*dtos.NavLink{}

	if hasAccess(ac.ReqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)) {
		adminNavLinks = append(adminNavLinks, &dtos.NavLink{
			Text: "Users", Id: "global-users", Url: hs.Cfg.AppSubURL + "/admin/users", Icon: "user",
		})
	}

	if hasGlobalAccess(ac.ReqGrafanaAdmin, orgsAccessEvaluator) {
		adminNavLinks = append(adminNavLinks, &dtos.NavLink{
			Text: "Orgs", Id: "global-orgs", Url: hs.Cfg.AppSubURL + "/admin/orgs", Icon: "building",
		})
	}

	if hasAccess(ac.ReqGrafanaAdmin, ac.EvalPermission(ac.ActionSettingsRead)) {
		adminNavLinks = append(adminNavLinks, &dtos.NavLink{
			Text: "Settings", Id: "server-settings", Url: hs.Cfg.AppSubURL + "/admin/settings", Icon: "sliders-v-alt",
		})
	}

	if hs.Cfg.LDAPEnabled && hasAccess(ac.ReqGrafanaAdmin, ac.EvalPermission(ac.ActionLDAPStatusRead)) {
		adminNavLinks = append(adminNavLinks, &dtos.NavLink{
			Text: "LDAP", Id: "ldap", Url: hs.Cfg.AppSubURL + "/admin/ldap", Icon: "book",
		})
	}

	if hs.Cfg.PluginAdminEnabled && ac.ReqGrafanaAdmin(c) {
		adminNavLinks = append(adminNavLinks, &dtos.NavLink{
			Text: "Plugins", Id: "admin-plugins", Url: hs.Cfg.AppSubURL + "/admin/plugins", Icon: "plug",
		})
	}

	return adminNavLinks
}

func (hs *HTTPServer) editorInAnyFolder(c *models.ReqContext) bool {
	hasEditPermissionInFoldersQuery := models.HasEditPermissionInFoldersQuery{SignedInUser: c.SignedInUser}
	if err := hs.SQLStore.HasEditPermissionInFolders(c.Req.Context(), &hasEditPermissionInFoldersQuery); err != nil {
		return false
	}
	return hasEditPermissionInFoldersQuery.Result
}

func (hs *HTTPServer) setIndexViewData(c *models.ReqContext) (*dtos.IndexViewData, error) {
	hasAccess := ac.HasAccess(hs.AccessControl, c)
	hasEditPerm := hasAccess(hs.editorInAnyFolder, ac.EvalAny(ac.EvalPermission(dashboards.ActionDashboardsCreate), ac.EvalPermission(dashboards.ActionFoldersCreate)))

	settings, err := hs.getFrontendSettingsMap(c)
	if err != nil {
		return nil, err
	}

	settings["dateFormats"] = hs.Cfg.DateFormats

	prefsQuery := pref.GetPreferenceWithDefaultsQuery{UserID: c.UserId, OrgID: c.OrgId, Teams: c.Teams}
	prefs, err := hs.preferenceService.GetWithDefaults(c.Req.Context(), &prefsQuery)
	if err != nil {
		return nil, err
	}

	// Read locale from accept-language
	acceptLang := c.Req.Header.Get("Accept-Language")
	locale := "en-US"

	if len(acceptLang) > 0 {
		parts := strings.Split(acceptLang, ",")
		locale = parts[0]
	}

	appURL := setting.AppUrl
	appSubURL := hs.Cfg.AppSubURL

	// special case when doing localhost call from image renderer
	if c.IsRenderCall && !hs.Cfg.ServeFromSubPath {
		appURL = fmt.Sprintf("%s://localhost:%s", hs.Cfg.Protocol, hs.Cfg.HTTPPort)
		appSubURL = ""
		settings["appSubUrl"] = ""
	}

	navTree, err := hs.getNavTree(c, hasEditPerm, prefs)
	if err != nil {
		return nil, err
	}

	data := dtos.IndexViewData{
		User: &dtos.CurrentUser{
			Id:                         c.UserId,
			IsSignedIn:                 c.IsSignedIn,
			Login:                      c.Login,
			Email:                      c.Email,
			ExternalUserId:             c.SignedInUser.ExternalAuthId,
			Name:                       c.Name,
			OrgCount:                   c.OrgCount,
			OrgId:                      c.OrgId,
			OrgName:                    c.OrgName,
			OrgRole:                    c.OrgRole,
			GravatarUrl:                dtos.GetGravatarUrl(c.Email),
			IsGrafanaAdmin:             c.IsGrafanaAdmin,
			LightTheme:                 prefs.Theme == lightName,
			Timezone:                   prefs.Timezone,
			WeekStart:                  prefs.WeekStart,
			Locale:                     locale,
			HelpFlags1:                 c.HelpFlags1,
			HasEditPermissionInFolders: hasEditPerm,
		},
		Settings:                settings,
		Theme:                   prefs.Theme,
		AppUrl:                  appURL,
		AppSubUrl:               appSubURL,
		GoogleAnalyticsId:       setting.GoogleAnalyticsId,
		GoogleTagManagerId:      setting.GoogleTagManagerId,
		BuildVersion:            setting.BuildVersion,
		BuildCommit:             setting.BuildCommit,
		NewGrafanaVersion:       hs.grafanaUpdateChecker.LatestVersion(),
		NewGrafanaVersionExists: hs.grafanaUpdateChecker.UpdateAvailable(),
		AppName:                 setting.ApplicationName,
		AppNameBodyClass:        "app-grafana",
		FavIcon:                 "public/img/fav32.png",
		AppleTouchIcon:          "public/img/apple-touch-icon.png",
		AppTitle:                "Grafana",
		NavTree:                 navTree,
		Sentry:                  &hs.Cfg.Sentry,
		Nonce:                   c.RequestNonce,
		ContentDeliveryURL:      hs.Cfg.GetContentDeliveryURL(hs.License.ContentDeliveryPrefix()),
		LoadingLogo:             "public/img/grafana_icon.svg",
	}

	if !hs.AccessControl.IsDisabled() {
		userPermissions, err := hs.AccessControl.GetUserPermissions(c.Req.Context(), c.SignedInUser, ac.Options{ReloadCache: false})
		if err != nil {
			return nil, err
		}

		data.User.Permissions = ac.BuildPermissionsMap(userPermissions)
	}

	if setting.DisableGravatar {
		data.User.GravatarUrl = hs.Cfg.AppSubURL + "/public/img/user_profile.png"
	}

	if len(data.User.Name) == 0 {
		data.User.Name = data.User.Login
	}

	themeURLParam := c.Query("theme")
	if themeURLParam == lightName {
		data.User.LightTheme = true
		data.Theme = lightName
	} else if themeURLParam == darkName {
		data.User.LightTheme = false
		data.Theme = darkName
	}

	hs.HooksService.RunIndexDataHooks(&data, c)

	sort.SliceStable(data.NavTree, func(i, j int) bool {
		return data.NavTree[i].SortWeight < data.NavTree[j].SortWeight
	})

	return &data, nil
}

func (hs *HTTPServer) Index(c *models.ReqContext) {
	data, err := hs.setIndexViewData(c)
	if err != nil {
		c.Handle(hs.Cfg, 500, "Failed to get settings", err)
		return
	}
	c.HTML(http.StatusOK, "index", data)
}

func (hs *HTTPServer) NotFoundHandler(c *models.ReqContext) {
	if c.IsApiRequest() {
		c.JsonApiErr(404, "Not found", nil)
		return
	}

	data, err := hs.setIndexViewData(c)
	if err != nil {
		c.Handle(hs.Cfg, 500, "Failed to get settings", err)
		return
	}

	c.HTML(404, "index", data)
}
