package navtree

import (
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/navlinks"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/setting"
)

type Service interface {
	GetNavTree(c *models.ReqContext, hasEditPerm bool, prefs *pref.Preference) ([]*dtos.NavLink, error)
}

type ServiceImpl struct {
	cfg                  *setting.Cfg
	log                  log.Logger
	accessControl        ac.AccessControl
	pluginStore          plugins.Store
	pluginSettings       pluginsettings.Service
	starService          star.Service
	features             *featuremgmt.FeatureManager
	dashboardService     dashboards.DashboardService
	accesscontrolService accesscontrol.Service
	kvStore              kvstore.KVStore
	apiKeyService        apikey.Service
}

func ProvideService(cfg *setting.Cfg, accessControl ac.AccessControl, pluginStore plugins.Store, pluginSettings pluginsettings.Service, starService star.Service, features *featuremgmt.FeatureManager, dashboardService dashboards.DashboardService, accesscontrolService accesscontrol.Service, kvStore kvstore.KVStore, apiKeyService apikey.Service) Service {
	return &ServiceImpl{
		cfg:                  cfg,
		log:                  log.New("navtree service"),
		accessControl:        accessControl,
		pluginStore:          pluginStore,
		pluginSettings:       pluginSettings,
		starService:          starService,
		features:             features,
		dashboardService:     dashboardService,
		accesscontrolService: accesscontrolService,
		kvStore:              kvStore,
		apiKeyService:        apiKeyService,
	}
}

//nolint:gocyclo
func (srv *ServiceImpl) GetNavTree(c *models.ReqContext, hasEditPerm bool, prefs *pref.Preference) ([]*dtos.NavLink, error) {
	hasAccess := ac.HasAccess(srv.accessControl, c)
	var navTree []*dtos.NavLink

	if hasAccess(ac.ReqSignedIn, ac.EvalPermission(dashboards.ActionDashboardsRead)) {
		starredItemsLinks, err := srv.buildStarredItemsNavLinks(c, prefs)
		if err != nil {
			return nil, err
		}

		navTree = append(navTree, &dtos.NavLink{
			Text:           "Starred",
			Id:             "starred",
			Icon:           "star",
			SortWeight:     dtos.WeightSavedItems,
			Section:        dtos.NavSectionCore,
			Children:       starredItemsLinks,
			EmptyMessageId: "starred-empty",
		})

		dashboardChildLinks := srv.buildDashboardNavLinks(c, hasEditPerm)

		dashboardsUrl := "/dashboards"

		dashboardLink := &dtos.NavLink{
			Text:       "Dashboards",
			Id:         "dashboards",
			SubTitle:   "Manage dashboards and folders",
			Icon:       "apps",
			Url:        srv.cfg.AppSubURL + dashboardsUrl,
			SortWeight: dtos.WeightDashboard,
			Section:    dtos.NavSectionCore,
			Children:   dashboardChildLinks,
		}

		if srv.features.IsEnabled(featuremgmt.FlagTopnav) {
			dashboardLink.Id = "dashboards/browse"
		}

		navTree = append(navTree, dashboardLink)
	}

	canExplore := func(context *models.ReqContext) bool {
		return c.OrgRole == org.RoleAdmin || c.OrgRole == org.RoleEditor || setting.ViewersCanEdit
	}

	if setting.ExploreEnabled && hasAccess(canExplore, ac.EvalPermission(ac.ActionDatasourcesExplore)) {
		navTree = append(navTree, &dtos.NavLink{
			Text:       "Explore",
			Id:         "explore",
			SubTitle:   "Explore your data",
			Icon:       "compass",
			SortWeight: dtos.WeightExplore,
			Section:    dtos.NavSectionCore,
			Url:        srv.cfg.AppSubURL + "/explore",
		})
	}

	navTree = srv.addProfile(navTree, c)

	_, uaIsDisabledForOrg := srv.cfg.UnifiedAlerting.DisabledOrgs[c.OrgID]
	uaVisibleForOrg := srv.cfg.UnifiedAlerting.IsEnabled() && !uaIsDisabledForOrg

	if setting.AlertingEnabled != nil && *setting.AlertingEnabled {
		navTree = append(navTree, srv.buildLegacyAlertNavLinks(c)...)
	} else if uaVisibleForOrg {
		navTree = append(navTree, srv.buildAlertNavLinks(c, hasEditPerm)...)
	}

	if srv.features.IsEnabled(featuremgmt.FlagDataConnectionsConsole) {
		navTree = append(navTree, srv.buildDataConnectionsNavLink(c))
	}

	appLinks, err := srv.getAppLinks(c)
	if err != nil {
		return nil, err
	}

	// When topnav is enabled we can test new information architecture where plugins live in Apps category
	if srv.features.IsEnabled(featuremgmt.FlagTopnav) {
		navTree = append(navTree, &dtos.NavLink{
			Text:        "Apps",
			Icon:        "apps",
			Description: "App plugins",
			Id:          "apps",
			Children:    appLinks,
			Section:     dtos.NavSectionCore,
			Url:         srv.cfg.AppSubURL + "/apps",
		})
	} else {
		navTree = append(navTree, appLinks...)
	}

	configNodes, err := srv.setupConfigNodes(c)
	if err != nil {
		return navTree, err
	}

	if srv.features.IsEnabled(featuremgmt.FlagLivePipeline) {
		liveNavLinks := []*dtos.NavLink{}

		liveNavLinks = append(liveNavLinks, &dtos.NavLink{
			Text: "Status", Id: "live-status", Url: srv.cfg.AppSubURL + "/live", Icon: "exchange-alt",
		})
		liveNavLinks = append(liveNavLinks, &dtos.NavLink{
			Text: "Pipeline", Id: "live-pipeline", Url: srv.cfg.AppSubURL + "/live/pipeline", Icon: "arrow-to-right",
		})
		liveNavLinks = append(liveNavLinks, &dtos.NavLink{
			Text: "Cloud", Id: "live-cloud", Url: srv.cfg.AppSubURL + "/live/cloud", Icon: "cloud-upload",
		})
		navTree = append(navTree, &dtos.NavLink{
			Id:           "live",
			Text:         "Live",
			SubTitle:     "Event streaming",
			Icon:         "exchange-alt",
			Url:          srv.cfg.AppSubURL + "/live",
			Children:     liveNavLinks,
			Section:      dtos.NavSectionConfig,
			HideFromTabs: true,
		})
	}

	var configNode *dtos.NavLink
	var serverAdminNode *dtos.NavLink

	if len(configNodes) > 0 {
		configNode = &dtos.NavLink{
			Id:         dtos.NavIDCfg,
			Text:       "Configuration",
			SubTitle:   "Organization: " + c.OrgName,
			Icon:       "cog",
			Url:        configNodes[0].Url,
			Section:    dtos.NavSectionConfig,
			SortWeight: dtos.WeightConfig,
			Children:   configNodes,
		}
		if srv.features.IsEnabled(featuremgmt.FlagTopnav) {
			configNode.Url = "/admin"
		} else {
			configNode.Url = configNodes[0].Url
		}
		navTree = append(navTree, configNode)
	}

	adminNavLinks := srv.buildAdminNavLinks(c)

	if len(adminNavLinks) > 0 {
		serverAdminNode = navlinks.GetServerAdminNode(adminNavLinks)
		navTree = append(navTree, serverAdminNode)
	}

	if srv.features.IsEnabled(featuremgmt.FlagTopnav) {
		// Move server admin into Configuration and rename to administration
		if configNode != nil && serverAdminNode != nil {
			configNode.Text = "Administration"
			serverAdminNode.Url = "/admin/server"
			serverAdminNode.HideFromTabs = false
			configNode.Children = append(configNode.Children, serverAdminNode)
			adminNodeIndex := len(navTree) - 1
			navTree = navTree[:adminNodeIndex]
		}
	}

	navTree = srv.addHelpLinks(navTree, c)

	return navTree, nil
}

func (hs *ServiceImpl) addHelpLinks(navTree []*dtos.NavLink, c *models.ReqContext) []*dtos.NavLink {
	if setting.HelpEnabled {
		helpVersion := fmt.Sprintf(`%s v%s (%s)`, setting.ApplicationName, setting.BuildVersion, setting.BuildCommit)
		if hs.cfg.AnonymousHideVersion && !c.IsSignedIn {
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

func (hs *ServiceImpl) addProfile(navTree []*dtos.NavLink, c *models.ReqContext) []*dtos.NavLink {
	if setting.ProfileEnabled && c.IsSignedIn {
		navTree = append(navTree, hs.getProfileNode(c))
	}
	return navTree
}

func (hs *ServiceImpl) getProfileNode(c *models.ReqContext) *dtos.NavLink {
	// Only set login if it's different from the name
	var login string
	if c.SignedInUser.Login != c.SignedInUser.NameOrFallback() {
		login = c.SignedInUser.Login
	}
	gravatarURL := dtos.GetGravatarUrl(c.Email)

	children := []*dtos.NavLink{
		{
			Text: "Preferences", Id: "profile/settings", Url: hs.cfg.AppSubURL + "/profile", Icon: "sliders-v-alt",
		},
	}

	children = append(children, &dtos.NavLink{
		Text: "Notification history", Id: "profile/notifications", Url: hs.cfg.AppSubURL + "/profile/notifications", Icon: "bell",
	})

	if setting.AddChangePasswordLink() {
		children = append(children, &dtos.NavLink{
			Text: "Change password", Id: "profile/password", Url: hs.cfg.AppSubURL + "/profile/password",
			Icon: "lock",
		})
	}

	if !setting.DisableSignoutMenu {
		// add sign out first
		children = append(children, &dtos.NavLink{
			Text:         "Sign out",
			Id:           "sign-out",
			Url:          hs.cfg.AppSubURL + "/logout",
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
		Url:        hs.cfg.AppSubURL + "/profile",
		Section:    dtos.NavSectionConfig,
		SortWeight: dtos.WeightProfile,
		Children:   children,
		RoundIcon:  true,
	}
}

func (srv *ServiceImpl) buildStarredItemsNavLinks(c *models.ReqContext, prefs *pref.Preference) ([]*dtos.NavLink, error) {
	starredItemsChildNavs := []*dtos.NavLink{}

	query := star.GetUserStarsQuery{
		UserID: c.SignedInUser.UserID,
	}

	starredDashboardResult, err := srv.starService.GetByUser(c.Req.Context(), &query)
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
			OrgId: c.OrgID,
		}
		err := srv.dashboardService.GetDashboard(c.Req.Context(), query)
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

func (hs *ServiceImpl) buildDashboardNavLinks(c *models.ReqContext, hasEditPerm bool) []*dtos.NavLink {
	hasAccess := ac.HasAccess(hs.accessControl, c)
	hasEditPermInAnyFolder := func(c *models.ReqContext) bool {
		return hasEditPerm
	}

	dashboardChildNavs := []*dtos.NavLink{}
	if !hs.features.IsEnabled(featuremgmt.FlagTopnav) {
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "Browse", Id: "dashboards/browse", Url: hs.cfg.AppSubURL + "/dashboards", Icon: "sitemap",
		})
	}
	dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
		Text: "Playlists", Id: "dashboards/playlists", Url: hs.cfg.AppSubURL + "/playlists", Icon: "presentation-play",
	})

	if c.IsSignedIn {
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "Snapshots",
			Id:   "dashboards/snapshots",
			Url:  hs.cfg.AppSubURL + "/dashboard/snapshots",
			Icon: "camera",
		})

		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "Library panels",
			Id:   "dashboards/library-panels",
			Url:  hs.cfg.AppSubURL + "/library-panels",
			Icon: "library-panel",
		})
	}

	if hs.features.IsEnabled(featuremgmt.FlagScenes) {
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "Scenes",
			Id:   "scenes",
			Url:  hs.cfg.AppSubURL + "/scenes",
			Icon: "apps",
		})
	}

	if hasEditPerm {
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "Divider", Divider: true, Id: "divider", HideFromTabs: true,
		})

		if hasAccess(hasEditPermInAnyFolder, ac.EvalPermission(dashboards.ActionDashboardsCreate)) {
			dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
				Text: "New dashboard", Icon: "plus", Url: hs.cfg.AppSubURL + "/dashboard/new", HideFromTabs: true, Id: "dashboards/new", ShowIconInNavbar: true,
			})
		}

		if hasAccess(ac.ReqOrgAdminOrEditor, ac.EvalPermission(dashboards.ActionFoldersCreate)) {
			dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
				Text: "New folder", SubTitle: "Create a new folder to organize your dashboards", Id: "dashboards/folder/new",
				Icon: "plus", Url: hs.cfg.AppSubURL + "/dashboards/folder/new", HideFromTabs: true, ShowIconInNavbar: true,
			})
		}

		if hasAccess(hasEditPermInAnyFolder, ac.EvalPermission(dashboards.ActionDashboardsCreate)) {
			dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
				Text: "Import", SubTitle: "Import dashboard from file or Grafana.com", Id: "dashboards/import", Icon: "plus",
				Url: hs.cfg.AppSubURL + "/dashboard/import", HideFromTabs: true, ShowIconInNavbar: true,
			})
		}
	}
	return dashboardChildNavs
}

func (hs *ServiceImpl) buildLegacyAlertNavLinks(c *models.ReqContext) []*dtos.NavLink {
	var alertChildNavs []*dtos.NavLink
	alertChildNavs = append(alertChildNavs, &dtos.NavLink{
		Text: "Alert rules", Id: "alert-list", Url: hs.cfg.AppSubURL + "/alerting/list", Icon: "list-ul",
	})

	if c.HasRole(org.RoleEditor) {
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{
			Text: "Notification channels", Id: "channels", Url: hs.cfg.AppSubURL + "/alerting/notifications",
			Icon: "comment-alt-share",
		})
	}

	var alertNav = dtos.NavLink{
		Text:       "Alerting",
		SubTitle:   "Alert rules and notifications",
		Id:         "alerting-legacy",
		Icon:       "bell",
		Children:   alertChildNavs,
		Section:    dtos.NavSectionCore,
		SortWeight: dtos.WeightAlerting,
	}

	if hs.features.IsEnabled(featuremgmt.FlagTopnav) {
		alertNav.Url = hs.cfg.AppSubURL + "/alerting"
	} else {
		alertNav.Url = hs.cfg.AppSubURL + "/alerting/list"
	}

	return []*dtos.NavLink{&alertNav}
}

func (hs *ServiceImpl) buildAlertNavLinks(c *models.ReqContext, hasEditPerm bool) []*dtos.NavLink {
	hasAccess := ac.HasAccess(hs.accessControl, c)
	var alertChildNavs []*dtos.NavLink

	if hasAccess(ac.ReqViewer, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingRuleRead), ac.EvalPermission(ac.ActionAlertingRuleExternalRead))) {
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{
			Text: "Alert rules", Id: "alert-list", Url: hs.cfg.AppSubURL + "/alerting/list", Icon: "list-ul",
		})
	}

	if hasAccess(ac.ReqOrgAdminOrEditor, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingNotificationsRead), ac.EvalPermission(ac.ActionAlertingNotificationsExternalRead))) {
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{
			Text: "Contact points", Id: "receivers", Url: hs.cfg.AppSubURL + "/alerting/notifications",
			Icon: "comment-alt-share", SubTitle: "Manage the settings of your contact points",
		})
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{Text: "Notification policies", Id: "am-routes", Url: hs.cfg.AppSubURL + "/alerting/routes", Icon: "sitemap"})
	}

	if hasAccess(ac.ReqViewer, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingInstanceRead), ac.EvalPermission(ac.ActionAlertingInstancesExternalRead))) {
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{Text: "Silences", Id: "silences", Url: hs.cfg.AppSubURL + "/alerting/silences", Icon: "bell-slash"})
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{Text: "Alert groups", Id: "groups", Url: hs.cfg.AppSubURL + "/alerting/groups", Icon: "layer-group"})
	}

	if c.OrgRole == org.RoleAdmin {
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{
			Text: "Admin", Id: "alerting-admin", Url: hs.cfg.AppSubURL + "/alerting/admin",
			Icon: "cog",
		})
	}

	fallbackHasEditPerm := func(*models.ReqContext) bool { return hasEditPerm }

	if hasAccess(fallbackHasEditPerm, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingRuleCreate), ac.EvalPermission(ac.ActionAlertingRuleExternalWrite))) {
		alertChildNavs = append(alertChildNavs, &dtos.NavLink{
			Text: "Divider", Divider: true, Id: "divider", HideFromTabs: true,
		})

		alertChildNavs = append(alertChildNavs, &dtos.NavLink{
			Text: "New alert rule", SubTitle: "Create an alert rule", Id: "alert",
			Icon: "plus", Url: hs.cfg.AppSubURL + "/alerting/new", HideFromTabs: true, ShowIconInNavbar: true,
		})
	}

	if len(alertChildNavs) > 0 {
		var alertNav = dtos.NavLink{
			Text:       "Alerting",
			SubTitle:   "Alert rules and notifications",
			Id:         "alerting",
			Icon:       "bell",
			Children:   alertChildNavs,
			Section:    dtos.NavSectionCore,
			SortWeight: dtos.WeightAlerting,
		}

		if hs.features.IsEnabled(featuremgmt.FlagTopnav) {
			alertNav.Url = hs.cfg.AppSubURL + "/alerting"
		} else {
			alertNav.Url = hs.cfg.AppSubURL + "/alerting/list"
		}

		return []*dtos.NavLink{&alertNav}
	}
	return nil
}

func (hs *ServiceImpl) buildDataConnectionsNavLink(c *models.ReqContext) *dtos.NavLink {
	var children []*dtos.NavLink
	var navLink *dtos.NavLink

	baseId := "data-connections"
	baseUrl := hs.cfg.AppSubURL + "/" + baseId

	children = append(children, &dtos.NavLink{
		Id:          baseId + "-datasources",
		Text:        "Data sources",
		Icon:        "database",
		Description: "Add and configure data sources",
		Url:         baseUrl + "/datasources",
	})

	children = append(children, &dtos.NavLink{
		Id:          baseId + "-plugins",
		Text:        "Plugins",
		Icon:        "plug",
		Description: "Manage plugins",
		Url:         baseUrl + "/plugins",
	})

	children = append(children, &dtos.NavLink{
		Id:          baseId + "-cloud-integrations",
		Text:        "Cloud integrations",
		Icon:        "bolt",
		Description: "Manage your cloud integrations",
		Url:         baseUrl + "/cloud-integrations",
	})

	navLink = &dtos.NavLink{
		Text:       "Data Connections",
		Icon:       "link",
		Id:         baseId,
		Url:        baseUrl,
		Children:   children,
		Section:    dtos.NavSectionCore,
		SortWeight: dtos.WeightDataConnections,
	}

	return navLink
}

func (hs *ServiceImpl) buildAdminNavLinks(c *models.ReqContext) []*dtos.NavLink {
	hasAccess := ac.HasAccess(hs.accessControl, c)
	hasGlobalAccess := ac.HasGlobalAccess(hs.accessControl, hs.accesscontrolService, c)
	orgsAccessEvaluator := ac.EvalPermission(ActionOrgsRead)
	adminNavLinks := []*dtos.NavLink{}

	if hasAccess(ac.ReqGrafanaAdmin, ac.EvalPermission(ac.ActionUsersRead, ac.ScopeGlobalUsersAll)) {
		adminNavLinks = append(adminNavLinks, &dtos.NavLink{
			Text: "Users", Id: "global-users", Url: hs.cfg.AppSubURL + "/admin/users", Icon: "user",
		})
	}

	if hasGlobalAccess(ac.ReqGrafanaAdmin, orgsAccessEvaluator) {
		adminNavLinks = append(adminNavLinks, &dtos.NavLink{
			Text: "Orgs", Id: "global-orgs", Url: hs.cfg.AppSubURL + "/admin/orgs", Icon: "building",
		})
	}

	if hasAccess(ac.ReqGrafanaAdmin, ac.EvalPermission(ac.ActionSettingsRead)) {
		adminNavLinks = append(adminNavLinks, &dtos.NavLink{
			Text: "Settings", Id: "server-settings", Url: hs.cfg.AppSubURL + "/admin/settings", Icon: "sliders-v-alt",
		})
	}

	if hasAccess(ac.ReqGrafanaAdmin, ac.EvalPermission(ac.ActionSettingsRead)) && hs.features.IsEnabled(featuremgmt.FlagStorage) {
		adminNavLinks = append(adminNavLinks, &dtos.NavLink{
			Text:        "Storage",
			Id:          "storage",
			Description: "Manage file storage",
			Icon:        "cube",
			Url:         hs.cfg.AppSubURL + "/admin/storage",
		})
	}

	if hs.cfg.LDAPEnabled && hasAccess(ac.ReqGrafanaAdmin, ac.EvalPermission(ac.ActionLDAPStatusRead)) {
		adminNavLinks = append(adminNavLinks, &dtos.NavLink{
			Text: "LDAP", Id: "ldap", Url: hs.cfg.AppSubURL + "/admin/ldap", Icon: "book",
		})
	}

	return adminNavLinks
}
