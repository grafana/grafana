package navtreeimpl

import (
	"sort"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlesimpl"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/open-feature/go-sdk/openfeature"
)

type ServiceImpl struct {
	settingsProvider     setting.SettingsProvider
	log                  log.Logger
	accessControl        ac.AccessControl
	authnService         authn.Service
	pluginStore          pluginstore.Store
	pluginSettings       pluginsettings.Service
	starService          star.Service
	features             featuremgmt.FeatureToggles
	dashboardService     dashboards.DashboardService
	accesscontrolService ac.Service
	kvStore              kvstore.KVStore
	apiKeyService        apikey.Service
	license              licensing.Licensing

	// Navigation
	navigationAppConfig     map[string]NavigationAppConfig
	navigationAppPathConfig map[string]NavigationAppConfig
}

type NavigationAppConfig struct {
	SectionID  string
	SortWeight int64
	Text       string
	Icon       string
	SubTitle   string
	IsNew      bool
}

func ProvideService(settingsProvider setting.SettingsProvider, accessControl ac.AccessControl, pluginStore pluginstore.Store, pluginSettings pluginsettings.Service, starService star.Service,
	features featuremgmt.FeatureToggles, dashboardService dashboards.DashboardService, accesscontrolService ac.Service, kvStore kvstore.KVStore, apiKeyService apikey.Service,
	license licensing.Licensing, authnService authn.Service,
) navtree.Service {
	service := &ServiceImpl{
		settingsProvider:     settingsProvider,
		log:                  log.New("navtree service"),
		accessControl:        accessControl,
		authnService:         authnService,
		pluginStore:          pluginStore,
		pluginSettings:       pluginSettings,
		starService:          starService,
		features:             features,
		dashboardService:     dashboardService,
		accesscontrolService: accesscontrolService,
		kvStore:              kvStore,
		apiKeyService:        apiKeyService,
		license:              license,
	}

	service.readNavigationSettings()

	return service
}

//nolint:gocyclo
func (s *ServiceImpl) GetNavTree(c *contextmodel.ReqContext, prefs *pref.Preference) (*navtree.NavTreeRoot, error) {
	cfg := s.settingsProvider.Get()
	hasAccess := ac.HasAccess(s.accessControl, c)
	treeRoot := &navtree.NavTreeRoot{}
	ctx := c.Req.Context()

	treeRoot.AddSection(s.getHomeNode(c, prefs))

	if hasAccess(ac.EvalPermission(dashboards.ActionDashboardsRead)) {
		starredItemsLinks, err := s.buildStarredItemsNavLinks(c)
		if err != nil {
			return nil, err
		}

		treeRoot.AddSection(&navtree.NavLink{
			Text:           "Starred",
			Id:             "starred",
			Icon:           "star",
			SortWeight:     navtree.WeightSavedItems,
			Children:       starredItemsLinks,
			EmptyMessageId: "starred-empty",
			Url:            cfg.AppSubURL + "/dashboards?starred",
		})
	}

	if c.IsPublicDashboardView() || hasAccess(ac.EvalAny(
		ac.EvalPermission(dashboards.ActionFoldersRead), ac.EvalPermission(dashboards.ActionFoldersCreate),
		ac.EvalPermission(dashboards.ActionDashboardsRead), ac.EvalPermission(dashboards.ActionDashboardsCreate)),
	) {
		dashboardChildLinks := s.buildDashboardNavLinks(c)

		dashboardLink := &navtree.NavLink{
			Text:       "Dashboards",
			Id:         navtree.NavIDDashboards,
			SubTitle:   "Create and manage dashboards to visualize your data",
			Icon:       "apps",
			Url:        cfg.AppSubURL + "/dashboards",
			SortWeight: navtree.WeightDashboard,
			Children:   dashboardChildLinks,
		}

		treeRoot.AddSection(dashboardLink)
	}

	if cfg.ExploreEnabled && hasAccess(ac.EvalPermission(ac.ActionDatasourcesExplore)) {
		treeRoot.AddSection(&navtree.NavLink{
			Text:       "Explore",
			Id:         navtree.NavIDExplore,
			SubTitle:   "Explore your data",
			Icon:       "compass",
			SortWeight: navtree.WeightExplore,
			Url:        cfg.AppSubURL + "/explore",
		})
	}

	if hasAccess(ac.EvalPermission(ac.ActionDatasourcesExplore)) {
		treeRoot.AddSection(&navtree.NavLink{
			Text:       "Drilldown",
			Id:         navtree.NavIDDrilldown,
			SubTitle:   "Drill down into your data using Grafana's powerful queryless apps",
			Icon:       "drilldown",
			SortWeight: navtree.WeightDrilldown,
			Url:        cfg.AppSubURL + "/drilldown",
		})
	}

	if cfg.ProfileEnabled && c.IsSignedIn {
		treeRoot.AddSection(s.getProfileNode(c))
	}

	_, uaIsDisabledForOrg := cfg.UnifiedAlerting.DisabledOrgs[c.GetOrgID()]
	uaVisibleForOrg := cfg.UnifiedAlerting.IsEnabled() && !uaIsDisabledForOrg

	if uaVisibleForOrg {
		if alertingSection := s.buildAlertNavLinks(c); alertingSection != nil {
			treeRoot.AddSection(alertingSection)
		}
	}

	if connectionsSection := s.buildDataConnectionsNavLink(c); connectionsSection != nil {
		treeRoot.AddSection(connectionsSection)
	}

	orgAdminNode, err := s.getAdminNode(c)

	if orgAdminNode != nil && len(orgAdminNode.Children) > 0 {
		treeRoot.AddSection(orgAdminNode)
	} else if err != nil {
		return nil, err
	}

	s.addHelpLinks(treeRoot, c)

	if err := s.addAppLinks(treeRoot, c); err != nil {
		return nil, err
	}

	// remove user access if empty. Happens if grafana-auth-app is not injected
	if sec := treeRoot.FindById(navtree.NavIDCfgAccess); sec != nil && len(sec.Children) == 0 {
		treeRoot.RemoveSectionByID(navtree.NavIDCfgAccess)
	}
	// double-check and remove admin menu if empty
	if sec := treeRoot.FindById(navtree.NavIDCfg); sec != nil && len(sec.Children) == 0 {
		treeRoot.RemoveSectionByID(navtree.NavIDCfg)
	}

	enabled := openfeature.GetApiInstance().GetClient().Boolean(ctx, featuremgmt.FlagPinNavItems, true, openfeature.TransactionContext(ctx))
	if enabled && c.IsSignedIn {
		treeRoot.AddSection(&navtree.NavLink{
			Text:           "Bookmarks",
			Id:             navtree.NavIDBookmarks,
			Icon:           "bookmark",
			SortWeight:     navtree.WeightBookmarks,
			Children:       []*navtree.NavLink{},
			EmptyMessageId: "bookmarks-empty",
			Url:            cfg.AppSubURL + "/bookmarks",
		})
	}

	return treeRoot, nil
}

func (s *ServiceImpl) getHomeNode(c *contextmodel.ReqContext, prefs *pref.Preference) *navtree.NavLink {
	cfg := s.settingsProvider.Get()
	homeUrl := cfg.AppSubURL + "/"
	if !c.IsSignedIn && !cfg.Anonymous.Enabled {
		homeUrl = cfg.AppSubURL + "/login"
	} else {
		homePage := cfg.HomePage

		if prefs.HomeDashboardUID == "" && len(homePage) > 0 {
			homeUrl = homePage
		}
	}

	homeNode := &navtree.NavLink{
		Text:       "Home",
		Id:         "home",
		Url:        homeUrl,
		Icon:       "home-alt",
		SortWeight: navtree.WeightHome,
	}
	if c.IsSignedIn && c.HasRole(org.RoleAdmin) {
		ctx := c.Req.Context()
		if _, exists := s.pluginStore.Plugin(ctx, "grafana-setupguide-app"); exists {
			var children []*navtree.NavLink
			// setup guide (a submenu item under Home)
			children = append(children, &navtree.NavLink{
				Id:         "home-setup-guide",
				Text:       "Getting started guide",
				Url:        "/a/grafana-setupguide-app/getting-started",
				SortWeight: navtree.WeightHome,
			})
			homeNode.Children = children
		}
	}
	return homeNode
}

func isSupportBundlesEnabled(s *ServiceImpl) bool {
	cfg := s.settingsProvider.Get()
	return cfg.SectionWithEnvOverrides("support_bundles").Key("enabled").MustBool(true)
}

func (s *ServiceImpl) addHelpLinks(treeRoot *navtree.NavTreeRoot, c *contextmodel.ReqContext) {
	cfg := s.settingsProvider.Get()
	if cfg.HelpEnabled {
		// The version subtitle is set later by NavTree.ApplyHelpVersion
		helpNode := &navtree.NavLink{
			Text:       "Help",
			Id:         "help",
			Url:        "#",
			Icon:       "question-circle",
			SortWeight: navtree.WeightHelp,
			Children:   []*navtree.NavLink{},
		}

		treeRoot.AddSection(helpNode)

		hasAccess := ac.HasAccess(s.accessControl, c)
		supportBundleAccess := ac.EvalAny(
			ac.EvalPermission(supportbundlesimpl.ActionRead),
			ac.EvalPermission(supportbundlesimpl.ActionCreate),
		)

		if isSupportBundlesEnabled(s) && hasAccess(supportBundleAccess) {
			supportBundleNode := &navtree.NavLink{
				Text:       "Support bundles",
				Id:         "support-bundles",
				Url:        "/support-bundles",
				Icon:       "wrench",
				SortWeight: navtree.WeightHelp,
			}

			helpNode.Children = append(helpNode.Children, supportBundleNode)
		}
	}
}

func (s *ServiceImpl) getProfileNode(c *contextmodel.ReqContext) *navtree.NavLink {
	// Only set login if it's different from the name
	var login string
	if c.GetLogin() != c.GetName() {
		login = c.GetLogin()
	}
	gravatarURL := dtos.GetGravatarUrl(s.settingsProvider, c.GetEmail())

	cfg := s.settingsProvider.Get()
	children := []*navtree.NavLink{
		{
			Text: "Profile", Id: "profile/settings", Url: cfg.AppSubURL + "/profile", Icon: "sliders-v-alt",
		},
	}

	children = append(children, &navtree.NavLink{
		Text: "Notification history", Id: "profile/notifications", Url: cfg.AppSubURL + "/profile/notifications", Icon: "bell",
	})

	if cfg.AddChangePasswordLink() {
		children = append(children, &navtree.NavLink{
			Text: "Change password", Id: "profile/password", Url: cfg.AppSubURL + "/profile/password",
			Icon: "lock",
		})
	}

	return &navtree.NavLink{
		Text:       c.GetName(),
		SubTitle:   login,
		Id:         "profile",
		Img:        gravatarURL,
		Url:        cfg.AppSubURL + "/profile",
		SortWeight: navtree.WeightProfile,
		Children:   children,
		RoundIcon:  true,
	}
}

func (s *ServiceImpl) buildStarredItemsNavLinks(c *contextmodel.ReqContext) ([]*navtree.NavLink, error) {
	starredItemsChildNavs := []*navtree.NavLink{}

	userID, _ := identity.UserIdentifier(c.GetID())
	query := star.GetUserStarsQuery{
		UserID: userID,
	}

	starredDashboardResult, err := s.starService.GetByUser(c.Req.Context(), &query)
	if err != nil {
		return nil, err
	}

	if len(starredDashboardResult.UserStars) > 0 {
		var uids []string
		for uid := range starredDashboardResult.UserStars {
			uids = append(uids, uid)
		}
		starredDashboards, err := s.dashboardService.SearchDashboards(c.Req.Context(), &dashboards.FindPersistedDashboardsQuery{
			DashboardUIDs: uids,
			Type:          searchstore.TypeDashboard,
			OrgId:         c.GetOrgID(),
			SignedInUser:  c.SignedInUser,
		})
		if err != nil {
			return nil, err
		}
		// Set a loose limit to the first 50 starred dashboards found
		if len(starredDashboards) > 50 {
			starredDashboards = starredDashboards[:50]
		}

		sort.Slice(starredDashboards, func(i, j int) bool {
			return starredDashboards[i].Title < starredDashboards[j].Title
		})
		for _, starredItem := range starredDashboards {
			starredItemsChildNavs = append(starredItemsChildNavs, &navtree.NavLink{
				Id:   "starred/" + starredItem.UID,
				Text: starredItem.Title,
				Url:  starredItem.URL,
			})
		}
	}

	return starredItemsChildNavs, nil
}

func (s *ServiceImpl) buildDashboardNavLinks(c *contextmodel.ReqContext) []*navtree.NavLink {
	hasAccess := ac.HasAccess(s.accessControl, c)

	dashboardChildNavs := []*navtree.NavLink{}

	cfg := s.settingsProvider.Get()
	if c.IsSignedIn {
		if c.HasRole(org.RoleViewer) {
			dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
				Text: "Playlists", SubTitle: "Groups of dashboards that are displayed in a sequence", Id: "dashboards/playlists", Url: cfg.AppSubURL + "/playlists", Icon: "presentation-play",
			})
		}

		if cfg.SnapshotEnabled && hasAccess(ac.EvalPermission(dashboards.ActionSnapshotsRead)) {
			dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
				Text:     "Snapshots",
				SubTitle: "Interactive, publicly available, point-in-time representations of dashboards",
				Id:       "dashboards/snapshots",
				Url:      cfg.AppSubURL + "/dashboard/snapshots",
				Icon:     "camera",
			})
		}

		dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
			Text:     "Library panels",
			SubTitle: "Reusable panels that can be added to multiple dashboards",
			Id:       "dashboards/library-panels",
			Url:      cfg.AppSubURL + "/library-panels",
			Icon:     "library-panel",
		})

		if cfg.PublicDashboardsEnabled {
			dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
				Text: "Public dashboards",
				Id:   "dashboards/public",
				Url:  cfg.AppSubURL + "/dashboard/public",
				Icon: "library-panel",
			})
		}

		if s.features.IsEnabled(c.Req.Context(), featuremgmt.FlagRestoreDashboards) && (c.GetOrgRole() == org.RoleAdmin || c.IsGrafanaAdmin) {
			dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
				Text:     "Recently deleted",
				SubTitle: "Any items listed here for more than 30 days will be automatically deleted.",
				Id:       "dashboards/recently-deleted",
				Url:      cfg.AppSubURL + "/dashboard/recently-deleted",
			})
		}
	}

	if hasAccess(ac.EvalPermission(dashboards.ActionDashboardsCreate)) {
		dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
			Text: "New dashboard", Icon: "plus", Url: cfg.AppSubURL + "/dashboard/new", HideFromTabs: true, Id: "dashboards/new", IsCreateAction: true,
		})

		dashboardChildNavs = append(dashboardChildNavs, &navtree.NavLink{
			Text: "Import dashboard", SubTitle: "Import dashboard from file or Grafana.com", Id: "dashboards/import", Icon: "plus",
			Url: cfg.AppSubURL + "/dashboard/import", HideFromTabs: true, IsCreateAction: true,
		})
	}

	return dashboardChildNavs
}

func (s *ServiceImpl) buildAlertNavLinks(c *contextmodel.ReqContext) *navtree.NavLink {
	hasAccess := ac.HasAccess(s.accessControl, c)
	var alertChildNavs []*navtree.NavLink

	cfg := s.settingsProvider.Get()
	if hasAccess(ac.EvalAny(ac.EvalPermission(ac.ActionAlertingRuleRead), ac.EvalPermission(ac.ActionAlertingRuleExternalRead))) {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{
			Text: "Alert rules", SubTitle: "Rules that determine whether an alert will fire", Id: "alert-list", Url: cfg.AppSubURL + "/alerting/list", Icon: "list-ul",
		})
	}

	contactPointsPerms := []ac.Evaluator{
		ac.EvalPermission(ac.ActionAlertingNotificationsRead),
		ac.EvalPermission(ac.ActionAlertingNotificationsExternalRead),

		ac.EvalPermission(ac.ActionAlertingReceiversRead),
		ac.EvalPermission(ac.ActionAlertingReceiversReadSecrets),
		ac.EvalPermission(ac.ActionAlertingReceiversCreate),

		ac.EvalPermission(ac.ActionAlertingNotificationsTemplatesRead),
		ac.EvalPermission(ac.ActionAlertingNotificationsTemplatesWrite),
		ac.EvalPermission(ac.ActionAlertingNotificationsTemplatesDelete),
	}

	if hasAccess(ac.EvalAny(contactPointsPerms...)) {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{
			Text: "Contact points", SubTitle: "Choose how to notify your contact points when an alert instance fires", Id: "receivers", Url: cfg.AppSubURL + "/alerting/notifications",
			Icon: "comment-alt-share",
		})
	}

	if hasAccess(ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsRead),
		ac.EvalPermission(ac.ActionAlertingNotificationsExternalRead),
		ac.EvalPermission(ac.ActionAlertingRoutesRead),
		ac.EvalPermission(ac.ActionAlertingRoutesWrite),
		ac.EvalPermission(ac.ActionAlertingNotificationsTimeIntervalsRead),
		ac.EvalPermission(ac.ActionAlertingNotificationsTimeIntervalsWrite),
	)) {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{Text: "Notification policies", SubTitle: "Determine how alerts are routed to contact points", Id: "am-routes", Url: cfg.AppSubURL + "/alerting/routes", Icon: "sitemap"})
	}

	if hasAccess(ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingInstanceRead),
		ac.EvalPermission(ac.ActionAlertingInstancesExternalRead),
		ac.EvalPermission(ac.ActionAlertingSilencesRead),
	)) {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{Text: "Silences", SubTitle: "Stop notifications from one or more alerting rules", Id: "silences", Url: cfg.AppSubURL + "/alerting/silences", Icon: "bell-slash"})
	}

	if hasAccess(ac.EvalAny(ac.EvalPermission(ac.ActionAlertingInstanceRead), ac.EvalPermission(ac.ActionAlertingInstancesExternalRead))) {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{Text: "Alert groups", SubTitle: "See grouped alerts with active notifications", Id: "groups", Url: cfg.AppSubURL + "/alerting/groups", Icon: "layer-group"})
	}

	if s.features.IsEnabled(c.Req.Context(), featuremgmt.FlagAlertingCentralAlertHistory) {
		if hasAccess(ac.EvalAny(ac.EvalPermission(ac.ActionAlertingRuleRead))) {
			alertChildNavs = append(alertChildNavs, &navtree.NavLink{
				Text:     "History",
				SubTitle: "View a history of all alert events generated by your Grafana-managed alert rules. All alert events are displayed regardless of whether silences or mute timings are set.",
				Id:       "alerts-history",
				Url:      cfg.AppSubURL + "/alerting/history",
				Icon:     "history",
			})
		}
	}
	if c.GetOrgRole() == org.RoleAdmin && s.features.IsEnabled(c.Req.Context(), featuremgmt.FlagAlertRuleRestore) && s.features.IsEnabled(c.Req.Context(), featuremgmt.FlagAlertingRuleRecoverDeleted) {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{
			Text:     "Recently deleted",
			SubTitle: "Any items listed here for more than 30 days will be automatically deleted.",
			Id:       "alerts/recently-deleted",
			Url:      cfg.AppSubURL + "/alerting/recently-deleted",
		})
	}

	if c.GetOrgRole() == org.RoleAdmin {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{
			Text: "Settings", Id: "alerting-admin", Url: cfg.AppSubURL + "/alerting/admin",
			Icon: "cog",
		})
	}

	if hasAccess(ac.EvalAny(ac.EvalPermission(ac.ActionAlertingRuleCreate), ac.EvalPermission(ac.ActionAlertingRuleExternalWrite))) {
		alertChildNavs = append(alertChildNavs, &navtree.NavLink{
			Text: "Create alert rule", SubTitle: "Create an alert rule", Id: "alert",
			Icon: "plus", Url: cfg.AppSubURL + "/alerting/new", HideFromTabs: true, IsCreateAction: true,
		})
	}

	if len(alertChildNavs) > 0 {
		alertNav := navtree.NavLink{
			Text:       "Alerting",
			SubTitle:   "Learn about problems in your systems moments after they occur",
			Id:         navtree.NavIDAlerting,
			Icon:       "bell",
			Children:   alertChildNavs,
			SortWeight: navtree.WeightAlerting,
			Url:        cfg.AppSubURL + "/alerting",
		}

		return &alertNav
	}

	return nil
}

func (s *ServiceImpl) buildDataConnectionsNavLink(c *contextmodel.ReqContext) *navtree.NavLink {
	hasAccess := ac.HasAccess(s.accessControl, c)

	var children []*navtree.NavLink
	var navLink *navtree.NavLink

	cfg := s.settingsProvider.Get()
	baseUrl := cfg.AppSubURL + "/connections"

	if hasAccess(datasources.ConfigurationPageAccess) {
		// Add new connection
		children = append(children, &navtree.NavLink{
			Id:       "connections-add-new-connection",
			Text:     "Add new connection",
			SubTitle: "Browse and create new connections",
			Url:      baseUrl + "/add-new-connection",
			Children: []*navtree.NavLink{},
			Keywords: []string{"csv", "graphite", "json", "loki", "prometheus", "sql", "tempo"},
		})

		// Data sources
		children = append(children, &navtree.NavLink{
			Id:       "connections-datasources",
			Text:     "Data sources",
			SubTitle: "View and manage your connected data source connections",
			Url:      baseUrl + "/datasources",
			Children: []*navtree.NavLink{},
		})
	}

	if len(children) > 0 {
		// Connections (main)
		navLink = &navtree.NavLink{
			Text:       "Connections",
			Icon:       "adjust-circle",
			Id:         "connections",
			Url:        baseUrl,
			Children:   children,
			SortWeight: navtree.WeightDataConnections,
		}

		return navLink
	}
	return nil
}
