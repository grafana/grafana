package navtreeimpl

import (
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/querylibrary"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/setting"
)

type ServiceImpl struct {
	cfg                  *setting.Cfg
	log                  log.Logger
	accessControl        ac.AccessControl
	pluginStore          plugins.Store
	pluginSettings       pluginsettings.Service
	starService          star.Service
	features             *featuremgmt.FeatureManager
	dashboardService     dashboards.DashboardService
	accesscontrolService ac.Service
	kvStore              kvstore.KVStore
	apiKeyService        apikey.Service
	queryLibraryService  querylibrary.HTTPService

	// Navigation
	navigationAppConfig     map[string]NavigationAppConfig
	navigationAppPathConfig map[string]NavigationAppConfig
}

type NavigationAppConfig struct {
	SectionID  string
	SortWeight int64
	Text       string
}

func ProvideService(cfg *setting.Cfg, accessControl ac.AccessControl, pluginStore plugins.Store, pluginSettings pluginsettings.Service, starService star.Service, features *featuremgmt.FeatureManager, dashboardService dashboards.DashboardService, accesscontrolService ac.Service, kvStore kvstore.KVStore, apiKeyService apikey.Service, queryLibraryService querylibrary.HTTPService) navtree.Service {
	service := &ServiceImpl{
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
		queryLibraryService:  queryLibraryService,
	}

	service.readNavigationSettings()

	return service
}

//nolint:gocyclo
func (s *ServiceImpl) GetNavTree(c *models.ReqContext, hasEditPerm bool, prefs *pref.Preference) (*navtree.NavTreeRoot, error) {
	hasAccess := ac.HasAccess(s.accessControl, c)
	treeRoot := &navtree.NavTreeRoot{}

	treeRoot.AddSection(s.getHomeNode(c, prefs))

	if hasAccess(ac.ReqSignedIn, ac.EvalPermission(dashboards.ActionDashboardsRead)) {
		starredItemsLinks, err := s.buildStarredItemsNavLinks(c)
		if err != nil {
			return nil, err
		}

		treeRoot.AddSection(&navtree.NavLink{
			Text:           "Starred",
			Id:             "starred",
			Icon:           "star",
			SortWeight:     navtree.WeightSavedItems,
			Section:        navtree.NavSectionCore,
			Children:       starredItemsLinks,
			EmptyMessageId: "starred-empty",
		})
	}

	if c.IsPublicDashboardView || hasAccess(ac.ReqSignedIn, ac.EvalAny(ac.EvalPermission(dashboards.ActionDashboardsRead), ac.EvalPermission(dashboards.ActionDashboardsCreate))) {
		dashboardChildLinks := s.buildDashboardNavLinks(c, hasEditPerm)

		dashboardLink := &navtree.NavLink{
			Text:       "Dashboards",
			Id:         navtree.NavIDDashboards,
			SubTitle:   "Create and manage dashboards to visualize your data",
			Icon:       "apps",
			Url:        s.cfg.AppSubURL + "/dashboards",
			SortWeight: navtree.WeightDashboard,
			Section:    navtree.NavSectionCore,
			Children:   dashboardChildLinks,
		}

		treeRoot.AddSection(dashboardLink)
	}

	canExplore := func(context *models.ReqContext) bool {
		return c.OrgRole == org.RoleAdmin || c.OrgRole == org.RoleEditor || setting.ViewersCanEdit
	}

	if setting.ExploreEnabled && hasAccess(canExplore, ac.EvalPermission(ac.ActionDatasourcesExplore)) {
		treeRoot.AddSection(&navtree.NavLink{
			Text:       "Explore",
			Id:         "explore",
			SubTitle:   "Explore your data",
			Icon:       "compass",
			SortWeight: navtree.WeightExplore,
			Section:    navtree.NavSectionCore,
			Url:        s.cfg.AppSubURL + "/explore",
		})
	}

	if !s.queryLibraryService.IsDisabled() {
		treeRoot.AddSection(&navtree.NavLink{
			Text:       "Query Library",
			Id:         "query",
			SubTitle:   "Store, import, export and manage your team queries in an easy way.",
			Icon:       "file-search-alt",
			SortWeight: navtree.WeightQueryLibrary,
			Section:    navtree.NavSectionCore,
			Url:        s.cfg.AppSubURL + "/query-library",
		})
	}

	if setting.ProfileEnabled && c.IsSignedIn {
		treeRoot.AddSection(s.getProfileNode(c))
	}

	treeRoot.AddSection(&navtree.NavLink{
		Text:       "System Notifications",
		Id:         "system-notifications",
		SubTitle:   "",
		Icon:       "bell",
		SortWeight: navtree.WeightExplore,
		Section:    navtree.NavSectionCore,
		Url:        s.cfg.AppSubURL + "/system-notifications",
		HideFromTabs: true,
	})

	_, uaIsDisabledForOrg := s.cfg.UnifiedAlerting.DisabledOrgs[c.OrgID]
	uaVisibleForOrg := s.cfg.UnifiedAlerting.IsEnabled() && !uaIsDisabledForOrg

	if setting.AlertingEnabled != nil && *setting.AlertingEnabled {
		if legacyAlertSection := s.buildLegacyAlertNavLinks(c); legacyAlertSection != nil {
			treeRoot.AddSection(legacyAlertSection)
		}
	} else if uaVisibleForOrg {
		if alertingSection := s.buildAlertNavLinks(c, hasEditPerm); alertingSection != nil {
			treeRoot.AddSection(alertingSection)
		}
	}

	if s.features.IsEnabled(featuremgmt.FlagDataConnectionsConsole) {
		treeRoot.AddSection(s.buildDataConnectionsNavLink(c))
	}

	if s.features.IsEnabled(featuremgmt.FlagLivePipeline) {
		liveNavLinks := []*navtree.NavLink{}

		liveNavLinks = append(liveNavLinks, &navtree.NavLink{
			Text: "Status", Id: "live-status", Url: s.cfg.AppSubURL + "/live", Icon: "exchange-alt",
		})
		liveNavLinks = append(liveNavLinks, &navtree.NavLink{
			Text: "Pipeline", Id: "live-pipeline", Url: s.cfg.AppSubURL + "/live/pipeline", Icon: "arrow-to-right",
		})
		liveNavLinks = append(liveNavLinks, &navtree.NavLink{
			Text: "Cloud", Id: "live-cloud", Url: s.cfg.AppSubURL + "/live/cloud", Icon: "cloud-upload",
		})

		treeRoot.AddSection(&navtree.NavLink{
			Id:           "live",
			Text:         "Live",
			SubTitle:     "Event streaming",
			Icon:         "exchange-alt",
			Url:          s.cfg.AppSubURL + "/live",
			Children:     liveNavLinks,
			Section:      navtree.NavSectionConfig,
			HideFromTabs: true,
		})
	}

	orgAdminNode, err := s.getOrgAdminNode(c)

	if orgAdminNode != nil {
		treeRoot.AddSection(orgAdminNode)
	} else if err != nil {
		return nil, err
	}

	serverAdminNode := s.getServerAdminNode(c)

	if serverAdminNode != nil {
		treeRoot.AddSection(serverAdminNode)
	}

	s.addHelpLinks(treeRoot, c)

	if err := s.addAppLinks(treeRoot, c); err != nil {
		return nil, err
	}

	return treeRoot, nil
}

func (s *ServiceImpl) getHomeNode(c *models.ReqContext, prefs *pref.Preference) *navtree.NavLink {
	homeUrl := s.cfg.AppSubURL + "/"
	homePage := s.cfg.HomePage

	if prefs.HomeDashboardID == 0 && len(homePage) > 0 {
		homeUrl = homePage
	}

	if prefs.HomeDashboardID != 0 {
		slugQuery := models.GetDashboardRefByIdQuery{Id: prefs.HomeDashboardID}
		err := s.dashboardService.GetDashboardUIDById(c.Req.Context(), &slugQuery)
		if err == nil {
			homeUrl = models.GetDashboardUrl(slugQuery.Result.Uid, slugQuery.Result.Slug)
		}
	}

	homeNode := &navtree.NavLink{
		Text:       "Home",
		Id:         "home",
		Url:        homeUrl,
		Icon:       "home-alt",
		Section:    navtree.NavSectionCore,
		SortWeight: navtree.WeightHome,
	}
	if !s.features.IsEnabled(featuremgmt.FlagTopnav) {
		homeNode.HideFromMenu = true
	}
	return homeNode
}

func (s *ServiceImpl) addHelpLinks(treeRoot *navtree.NavTreeRoot, c *models.ReqContext) {
	if setting.HelpEnabled {
		helpVersion := fmt.Sprintf(`%s v%s (%s)`, setting.ApplicationName, setting.BuildVersion, setting.BuildCommit)
		if s.cfg.AnonymousHideVersion && !c.IsSignedIn {
			helpVersion = setting.ApplicationName
		}

		treeRoot.AddSection(&navtree.NavLink{
			Text:       "Help",
			SubTitle:   helpVersion,
			Id:         "help",
			Url:        "#",
			Icon:       "question-circle",
			SortWeight: navtree.WeightHelp,
			Section:    navtree.NavSectionConfig,
			Children:   []*navtree.NavLink{},
		})
	}
}

func (s *ServiceImpl) getProfileNode(c *models.ReqContext) *navtree.NavLink {
	// Only set login if it's different from the name
	var login string
	if c.SignedInUser.Login != c.SignedInUser.NameOrFallback() {
		login = c.SignedInUser.Login
	}
	gravatarURL := dtos.GetGravatarUrl(c.Email)

	children := []*navtree.NavLink{
		{
			Text: "Preferences", Id: "profile/settings", Url: s.cfg.AppSubURL + "/profile", Icon: "sliders-v-alt",
		},
	}

	children = append(children, &navtree.NavLink{
		Text: "Notification history", Id: "profile/notifications", Url: s.cfg.AppSubURL + "/profile/notifications", Icon: "bell",
	})

	if setting.AddChangePasswordLink() {
		children = append(children, &navtree.NavLink{
			Text: "Change password", Id: "profile/password", Url: s.cfg.AppSubURL + "/profile/password",
			Icon: "lock",
		})
	}

	if !setting.DisableSignoutMenu {
		// add sign out first
		children = append(children, &navtree.NavLink{
			Text:         "Sign out",
			Id:           "sign-out",
			Url:          s.cfg.AppSubURL + "/logout",
			Icon:         "arrow-from-right",
			Target:       "_self",
			HideFromTabs: true,
		})
	}

	return &navtree.NavLink{
		Text:       c.SignedInUser.NameOrFallback(),
		SubTitle:   login,
		Id:         "profile",
		Img:        gravatarURL,
		Url:        s.cfg.AppSubURL + "/profile",
		Section:    navtree.NavSectionConfig,
		SortWeight: navtree.WeightProfile,
		Children:   children,
		RoundIcon:  true,
	}
}

func (s *ServiceImpl) buildStarredItemsNavLinks(c *models.ReqContext) ([]*navtree.NavLink, error) {
	starredItemsChildNavs := []*navtree.NavLink{}

	query := star.GetUserStarsQuery{
		UserID: c.SignedInUser.UserID,
	}

	starredDashboardResult, err := s.starService.GetByUser(c.Req.Context(), &query)
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
		err := s.dashboardService.GetDashboard(c.Req.Context(), query)
		if err == nil {
			starredDashboards = append(starredDashboards, query.Result)
		}
	}

	if len(starredDashboards) > 0 {
		sort.Slice(starredDashboards, func(i, j int) bool {
			return starredDashboards[i].Title < starredDashboards[j].Title
		})
		for _, starredItem := range starredDashboards {
			starredItemsChildNavs = append(starredItemsChildNavs, &navtree.NavLink{
				Id:   starredItem.Uid,
				Text: starredItem.Title,
				Url:  starredItem.GetUrl(),
			})
		}
	}

	return starredItemsChildNavs, nil
}

func (s *ServiceImpl) buildDashboardNavLinks(c *models.ReqContext, hasEditPerm bool) []*navtree.NavLink {
	hasAccess := ac.HasAccess(s.accessControl, c)
	hasEditPermInAnyFolder := func(c *models.ReqContext) bool {
		return hasEditPerm
	}

	dashboardChildNavs := []*navtree.NavLink{}

	if !s.features.IsEnabled(featuremgmt.FlagTopnav) {
		dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
			Text: "Browse", Id: navtree.NavIDDashboardsBrowse, Url: s.cfg.AppSubURL + "/dashboards", Icon: "sitemap",
		})
	}

	dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
		Text: "Playlists", SubTitle: "Groups of dashboards that are displayed in a sequence", Id: "dashboards/playlists", Url: s.cfg.AppSubURL + "/playlists", Icon: "presentation-play",
	})

	if c.IsSignedIn {
		dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
			Text:     "Snapshots",
			SubTitle: "Interactive, publically available, point-in-time representations of dashboards",
			Id:       "dashboards/snapshots",
			Url:      s.cfg.AppSubURL + "/dashboard/snapshots",
			Icon:     "camera",
		})

		dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
			Text:     "Library panels",
			SubTitle: "Reusable panels that can be added to multiple dashboards",
			Id:       "dashboards/library-panels",
			Url:      s.cfg.AppSubURL + "/library-panels",
			Icon:     "library-panel",
		})

		if s.features.IsEnabled(featuremgmt.FlagPublicDashboards) {
			dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
				Text: "Public dashboards",
				Id:   "dashboards/public",
				Url:  s.cfg.AppSubURL + "/dashboard/public",
				Icon: "library-panel",
			})
		}
	}

	if s.features.IsEnabled(featuremgmt.FlagScenes) {
		dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
			Text: "Scenes",
			Id:   "scenes",
			Url:  s.cfg.AppSubURL + "/scenes",
			Icon: "apps",
		})
	}

	if hasEditPerm && !s.features.IsEnabled(featuremgmt.FlagTopnav) {
		dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
			Text: "Divider", Divider: true, Id: "divider", HideFromTabs: true,
		})
	}

	if hasEditPerm {
		if hasAccess(hasEditPermInAnyFolder, ac.EvalPermission(dashboards.ActionDashboardsCreate)) {
			dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
				Text: "New dashboard", Icon: "plus", Url: s.cfg.AppSubURL + "/dashboard/new", HideFromTabs: true, Id: "dashboards/new", ShowIconInNavbar: true, IsCreateAction: true,
			})
		}
	}

	if hasEditPerm && !s.features.IsEnabled(featuremgmt.FlagTopnav) {
		if hasAccess(ac.ReqOrgAdminOrEditor, ac.EvalPermission(dashboards.ActionFoldersCreate)) {
			dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
				Text: "New folder", SubTitle: "Create a new folder to organize your dashboards", Id: "dashboards/folder/new",
				Icon: "plus", Url: s.cfg.AppSubURL + "/dashboards/folder/new", HideFromTabs: true, ShowIconInNavbar: true,
			})
		}

		if hasAccess(hasEditPermInAnyFolder, ac.EvalPermission(dashboards.ActionDashboardsCreate)) {
			dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
				Text: "Import", SubTitle: "Import dashboard from file or Grafana.com", Id: "dashboards/import", Icon: "plus",
				Url: s.cfg.AppSubURL + "/dashboard/import", HideFromTabs: true, ShowIconInNavbar: true,
			})
		}
	}

	return dashboardChildNavs
}

func (s *ServiceImpl) buildLegacyAlertNavLinks(c *models.ReqContext) *navtree.NavLink {
	var alertChildNavs []*navtree.NavLink
	alertChildNavs = append(alertChildNavs, &navtree.NavLink{
		Text: "Alert rules", Id: "alert-list", Url: s.cfg.AppSubURL + "/alerting/list", Icon: "list-ul",
	})

	if c.HasRole(org.RoleEditor) {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{
			Text: "Notification channels", Id: "channels", Url: s.cfg.AppSubURL + "/alerting/notifications",
			Icon: "comment-alt-share",
		})
	}

	var alertNav = navtree.NavLink{
		Text:       "Alerting",
		SubTitle:   "Learn about problems in your systems moments after they occur",
		Id:         "alerting-legacy",
		Icon:       "bell",
		Children:   alertChildNavs,
		Section:    navtree.NavSectionCore,
		SortWeight: navtree.WeightAlerting,
	}

	if s.features.IsEnabled(featuremgmt.FlagTopnav) {
		alertNav.Url = s.cfg.AppSubURL + "/alerting"
	} else {
		alertNav.Url = s.cfg.AppSubURL + "/alerting/list"
	}

	return &alertNav
}

func (s *ServiceImpl) buildAlertNavLinks(c *models.ReqContext, hasEditPerm bool) *navtree.NavLink {
	hasAccess := ac.HasAccess(s.accessControl, c)
	var alertChildNavs []*navtree.NavLink

	if hasAccess(ac.ReqViewer, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingRuleRead), ac.EvalPermission(ac.ActionAlertingRuleExternalRead))) {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{
			Text: "Alert rules", SubTitle: "Rules that determine whether an alert will fire", Id: "alert-list", Url: s.cfg.AppSubURL + "/alerting/list", Icon: "list-ul",
		})
	}

	if hasAccess(ac.ReqOrgAdminOrEditor, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingNotificationsRead), ac.EvalPermission(ac.ActionAlertingNotificationsExternalRead))) {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{
			Text: "Contact points", SubTitle: "Decide how your contacts are notified when an alert fires", Id: "receivers", Url: s.cfg.AppSubURL + "/alerting/notifications",
			Icon: "comment-alt-share",
		})
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{Text: "Notification policies", SubTitle: "Determine how alerts are routed to contact points", Id: "am-routes", Url: s.cfg.AppSubURL + "/alerting/routes", Icon: "sitemap"})
	}

	if hasAccess(ac.ReqViewer, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingInstanceRead), ac.EvalPermission(ac.ActionAlertingInstancesExternalRead))) {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{Text: "Silences", SubTitle: "Stop notifications from one or more alerting rules", Id: "silences", Url: s.cfg.AppSubURL + "/alerting/silences", Icon: "bell-slash"})
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{Text: "Alert groups", SubTitle: "See grouped alerts from an Alertmanager instance", Id: "groups", Url: s.cfg.AppSubURL + "/alerting/groups", Icon: "layer-group"})
	}

	if c.OrgRole == org.RoleAdmin {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{
			Text: "Admin", Id: "alerting-admin", Url: s.cfg.AppSubURL + "/alerting/admin",
			Icon: "cog",
		})
	}

	fallbackHasEditPerm := func(*models.ReqContext) bool { return hasEditPerm }

	if hasAccess(fallbackHasEditPerm, ac.EvalAny(ac.EvalPermission(ac.ActionAlertingRuleCreate), ac.EvalPermission(ac.ActionAlertingRuleExternalWrite))) {
		if !s.features.IsEnabled(featuremgmt.FlagTopnav) {
			alertChildNavs = append(alertChildNavs, &navtree.NavLink{
				Text: "Divider", Divider: true, Id: "divider", HideFromTabs: true,
			})
		}

		alertChildNavs = append(alertChildNavs, &navtree.NavLink{
			Text: "New alert rule", SubTitle: "Create an alert rule", Id: "alert",
			Icon: "plus", Url: s.cfg.AppSubURL + "/alerting/new", HideFromTabs: true, ShowIconInNavbar: true, IsCreateAction: true,
		})
	}

	if len(alertChildNavs) > 0 {
		var alertNav = navtree.NavLink{
			Text:       "Alerting",
			SubTitle:   "Learn about problems in your systems moments after they occur",
			Id:         navtree.NavIDAlerting,
			Icon:       "bell",
			Children:   alertChildNavs,
			Section:    navtree.NavSectionCore,
			SortWeight: navtree.WeightAlerting,
		}

		if s.features.IsEnabled(featuremgmt.FlagTopnav) {
			alertNav.Url = s.cfg.AppSubURL + "/alerting"
		} else {
			alertNav.Url = s.cfg.AppSubURL + "/alerting/list"
		}

		return &alertNav
	}

	return nil
}

func (s *ServiceImpl) buildDataConnectionsNavLink(c *models.ReqContext) *navtree.NavLink {
	var children []*navtree.NavLink
	var navLink *navtree.NavLink

	baseUrl := s.cfg.AppSubURL + "/connections"

	// Your connections
	children = append(children, &navtree.NavLink{
		Id:       "connections-your-connections",
		Text:     "Your connections",
		SubTitle: "Manage your existing connections",
		Url:      baseUrl + "/your-connections",
		// Datasources
		Children: []*navtree.NavLink{{
			Id:       "connections-your-connections-datasources",
			Text:     "Data sources",
			SubTitle: "View and manage your connected data source connections",
			Url:      baseUrl + "/your-connections/datasources",
		}},
	})

	// Connect data
	children = append(children, &navtree.NavLink{
		Id:       "connections-connect-data",
		Text:     "Connect data",
		SubTitle: "Browse and create new connections",
		Url:      s.cfg.AppSubURL + "/connections/connect-data",
		Children: []*navtree.NavLink{},
	})

	// Connections (main)
	navLink = &navtree.NavLink{
		Text:       "Connections",
		Icon:       "link",
		Id:         "connections",
		Url:        baseUrl,
		Children:   children,
		Section:    navtree.NavSectionCore,
		SortWeight: navtree.WeightDataConnections,
	}

	return navLink
}
