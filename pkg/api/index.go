package api

import (
	"fmt"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// Themes
	lightName = "light"
	darkName  = "dark"
)

func getProfileNode(c *models.ReqContext) *dtos.NavLink {
	// Only set login if it's different from the name
	var login string
	if c.SignedInUser.Login != c.SignedInUser.NameOrFallback() {
		login = c.SignedInUser.Login
	}
	gravatarURL := dtos.GetGravatarUrl(c.Email)

	children := []*dtos.NavLink{
		{
			Text: "Preferences", Id: "profile-settings", Url: setting.AppSubUrl + "/profile", Icon: "sliders-v-alt",
		},
	}

	if setting.AddChangePasswordLink() {
		children = append(children, &dtos.NavLink{
			Text: "Change Password", Id: "change-password", Url: setting.AppSubUrl + "/profile/password",
			Icon: "lock", HideFromMenu: true,
		})
	}

	if !setting.DisableSignoutMenu {
		// add sign out first
		children = append(children, &dtos.NavLink{
			Text:         "Sign out",
			Id:           "sign-out",
			Url:          setting.AppSubUrl + "/logout",
			Icon:         "arrow-from-right",
			Target:       "_self",
			HideFromTabs: true,
		})
	}

	return &dtos.NavLink{
		Text:         c.SignedInUser.NameOrFallback(),
		SubTitle:     login,
		Id:           "profile",
		Img:          gravatarURL,
		Url:          setting.AppSubUrl + "/profile",
		HideFromMenu: true,
		SortWeight:   dtos.WeightProfile,
		Children:     children,
	}
}

func getAppLinks(c *models.ReqContext) ([]*dtos.NavLink, error) {
	enabledPlugins, err := plugins.GetEnabledPlugins(c.OrgId)
	if err != nil {
		return nil, err
	}

	appLinks := []*dtos.NavLink{}
	for _, plugin := range enabledPlugins.Apps {
		if !plugin.Pinned {
			continue
		}

		appLink := &dtos.NavLink{
			Text:       plugin.Name,
			Id:         "plugin-page-" + plugin.Id,
			Url:        plugin.DefaultNavUrl,
			Img:        plugin.Info.Logos.Small,
			SortWeight: dtos.WeightPlugin,
		}

		for _, include := range plugin.Includes {
			if !c.HasUserRole(include.Role) {
				continue
			}

			if include.Type == "page" && include.AddToNav {
				var link *dtos.NavLink
				if len(include.Path) > 0 {
					link = &dtos.NavLink{
						Url:  setting.AppSubUrl + include.Path,
						Text: include.Name,
					}
					if include.DefaultNav {
						appLink.Url = link.Url // Overwrite the hardcoded page logic
					}
				} else {
					link = &dtos.NavLink{
						Url:  setting.AppSubUrl + "/plugins/" + plugin.Id + "/page/" + include.Slug,
						Text: include.Name,
					}
				}
				link.Icon = include.Icon
				appLink.Children = append(appLink.Children, link)
			}

			if include.Type == "dashboard" && include.AddToNav {
				link := &dtos.NavLink{
					Url:  setting.AppSubUrl + "/dashboard/db/" + include.Slug,
					Text: include.Name,
				}
				appLink.Children = append(appLink.Children, link)
			}
		}

		if len(appLink.Children) > 0 {
			appLinks = append(appLinks, appLink)
		}
	}

	return appLinks, nil
}

func (hs *HTTPServer) getNavTree(c *models.ReqContext, hasEditPerm bool) ([]*dtos.NavLink, error) {
	navTree := []*dtos.NavLink{}

	if hasEditPerm {
		children := []*dtos.NavLink{
			{Text: "Dashboard", Icon: "apps", Url: setting.AppSubUrl + "/dashboard/new"},
		}
		if c.OrgRole == models.ROLE_ADMIN || c.OrgRole == models.ROLE_EDITOR {
			children = append(children, &dtos.NavLink{
				Text: "Folder", SubTitle: "Create a new folder to organize your dashboards", Id: "folder",
				Icon: "folder-plus", Url: setting.AppSubUrl + "/dashboards/folder/new",
			})
		}
		children = append(children, &dtos.NavLink{
			Text: "Import", SubTitle: "Import dashboard from file or Grafana.com", Id: "import", Icon: "import",
			Url: setting.AppSubUrl + "/dashboard/import",
		})
		navTree = append(navTree, &dtos.NavLink{
			Text:       "Create",
			Id:         "create",
			Icon:       "plus",
			Url:        setting.AppSubUrl + "/dashboard/new",
			Children:   children,
			SortWeight: dtos.WeightCreate,
		})
	}

	inventoryChildNavs := []*dtos.NavLink{
		{Text: "Inventory list", Id: "home", Url: setting.AppSubUrl + "/inventory", Icon: "percona-inventory", HideFromTabs: true},
		{Text: "Add instance", Id: "home", Url: setting.AppSubUrl + "/add-instance", Icon: "percona-add", HideFromTabs: true},
	}

	nodeSummaryChildNavs := []*dtos.NavLink{
		{Text: "CPU Utilization", Id: "home", Url: setting.AppSubUrl + "/d/node-cpu/cpu-utilization-details", Icon: "percona-cpu", HideFromTabs: true},
		{Text: "Disk", Id: "home", Url: setting.AppSubUrl + "/d/node-disk/disk-details", Icon: "percona-disk", HideFromTabs: true},
		{Text: "Memory", Id: "home", Url: setting.AppSubUrl + "/d/node-memory/memory-details", Icon: "percona-memory", HideFromTabs: true},
		{Text: "Network", Id: "home", Url: setting.AppSubUrl + "/d/node-network/network-details", Icon: "percona-network", HideFromTabs: true},
		{Text: "Temperature", Id: "home", Url: setting.AppSubUrl + "/d/node-temp/node-temperature-details", Icon: "percona-temperature", HideFromTabs: true},
		{Text: "NUMA", Id: "home", Url: setting.AppSubUrl + "/d/node-memory-numa/numa-details", Icon: "percona-cluster-network", HideFromTabs: true},
		{Text: "Processes", Id: "home", Url: setting.AppSubUrl + "/d/node-cpu-process/processes-details", Icon: "percona-process", HideFromTabs: true},
	}

	nodeChildNavs := []*dtos.NavLink{
		{Text: "Node Overview", Id: "home", Url: setting.AppSubUrl + "/d/node-instance-overview/nodes-overview", Icon: "percona-cluster-network", HideFromTabs: true},
		{Text: "Node Summary", Id: "home", Url: setting.AppSubUrl + "/d/node-instance-summary/node-summary", Icon: "percona-summary", HideFromTabs: true, Children: nodeSummaryChildNavs},
	}

	mysqlHAChildNavs := []*dtos.NavLink{
		{Text: "MySQL Group Replication Summary", Id: "home", Url: setting.AppSubUrl + "/d/mysql-group-replicaset-summary/mysql-group-replication-summary", Icon: "percona-cluster", HideFromTabs: true},
		{Text: "MySQL Replication Summary", Id: "home", Url: setting.AppSubUrl + "/d/mysql-replicaset-summary/mysql-replication-summary", Icon: "percona-cluster", HideFromTabs: true},
		{Text: "PXC/Galera Cluster Summary", Id: "home", Url: setting.AppSubUrl + "/d/pxc-cluster-summary/pxc-galera-cluster-summary", Icon: "percona-cluster", HideFromTabs: true},
		{Text: "PXC/Galera Node Summary", Id: "home", Url: setting.AppSubUrl + "/d/pxc-node-summary/pxc-galera-node-summary", Icon: "percona-cluster", HideFromTabs: true},
		{Text: "PXC/Galera Nodes Compare", Id: "home", Url: setting.AppSubUrl + "/d/pxc-nodes-compare/pxc-galera-nodes-compare", Icon: "percona-cluster", HideFromTabs: true},
	}

	mysqlSummaryChildNavs := []*dtos.NavLink{
		{
			Text: "MySQL Command/Handler Counters Compare",
			Id:   "mysql-command-handler-counters-compare",
			Url:  setting.AppSubUrl + "/d/mysql-commandhandler-compare/mysql-command-handler-counters-compare",
			Icon: "sitemap",
		},
		{
			Text: "MySQL InnoDB Compression Details",
			Id:   "mysql-innodb-compression-details",
			Url:  setting.AppSubUrl + "/d/mysql-innodb-compression/mysql-innodb-compression-details",
			Icon: "sitemap",
		},
		{
        	Text: "MySQL InnoDB Details",
        	Id:   "mysql-innodb-details",
        	Url:  setting.AppSubUrl + "/d/mysql-innodb/mysql-innodb-details",
        	Icon: "sitemap",
		},
		{
			Text: "MySQL Performance Schema Details",
			Id:   "mysql-performance-schema-details",
			Url:  setting.AppSubUrl + "/d/mysql-performance-schema/mysql-performance-schema-details",
			Icon: "sitemap",
		},
		{
			Text: "MySQL Query Response Time Details",
			Id:   "mysql-query-response-time-details",
			Url:  setting.AppSubUrl + "/d/mysql-queryresponsetime/mysql-query-response-time-details",
			Icon: "sitemap",
		},
		{
			Text: "MySQL Table Details",
			Id:   "mysql-table-details",
			Url:  setting.AppSubUrl + "/d/mysql-table/mysql-table-details",
			Icon: "sitemap",
		},
		{
			Text: "MySQL TokuDB Details",
			Id:   "mysql-tokudb-details",
			Url:  setting.AppSubUrl + "/d/mysql-tokudb/mysql-tokudb-details",
			Icon: "sitemap",
		},
		{
			Text: "MySQL User Details",
			Id:   "mysql-user-details",
			Url:  setting.AppSubUrl + "/d/mysql-user/mysql-user-details",
			Icon: "sitemap",
		},
		{
			Text: "MySQL Wait Event Analyses Details",
			Id:   "mysql-wait-event-analyses-details",
			Url:  setting.AppSubUrl + "/d/mysql-waitevents-analysis/mysql-wait-event-analyses-details",
			Icon: "sitemap",
		},
		{
			Text: "MySQL MyISAM/Aria Details",
			Id:   "mysql-myisam-aria-details",
			Url:  setting.AppSubUrl + "/d/mysql-myisamaria/mysql-myisam-aria-details",
			Icon: "sitemap",
		},
		{
			Text: "MySQL MyRocks Details",
			Id:   "mysql-myrocks-details",
			Url:  setting.AppSubUrl + "/d/mysql-myrocks/mysql-myrocks-details",
			Icon: "sitemap",
		},
		{
			Text: "MySQL Amazon Aurora Details",
			Id:   "mysql-amazon-aurora-details",
			Url:  setting.AppSubUrl + "/d/mysql-amazonaurora/mysql-amazon-aurora-details",
			Icon: "sitemap",
		},
	}

	mysqlChildNavs := []*dtos.NavLink{
		{Text: "HA (High availability)", Id: "home", Icon: "percona-cluster", HideFromTabs: true, Children: mysqlHAChildNavs},
		{Text: "MySQL Overview", Id: "home", Url: setting.AppSubUrl + "/d/mysql-instance-overview/mysql-instances-overview", Icon: "percona-cluster-network", HideFromTabs: true},
		{Text: "MySQL Summary", Id: "home", Url: setting.AppSubUrl + "/d/mysql-instance-summary/mysql-instances-summary", Icon: "percona-summary", HideFromTabs: true, Children: mysqlSummaryChildNavs},
	}

	mongodbHAChildNavs := []*dtos.NavLink{
		{Text: "MongoDB Cluster Summary", Id: "home", Url: setting.AppSubUrl + "/d/mongodb-cluster-summary/mongodb-cluster-summary", Icon: "percona-cluster", HideFromTabs: true},
		{Text: "MongoDB ReplSet Summary", Id: "home", Url: setting.AppSubUrl + "/d/mongodb-replicaset-summary/mongodb-replset-summary", Icon: "percona-cluster", HideFromTabs: true},
	}

	mongodbSummaryChildNavs := []*dtos.NavLink{
		{Text: "MongoDB InMemory Details", Id: "home", Url: setting.AppSubUrl + "/d/mongodb-inmemory/mongodb-inmemory-details", Icon: "sitemap", HideFromTabs: true},
		{Text: "MongoDB MMAPv1 Details", Id: "home", Url: setting.AppSubUrl + "/d/mongodb-mmapv1/mongodb-mmapv1-details", Icon: "sitemap", HideFromTabs: true},
		{Text: "MongoDB WiredTiger Details", Id: "home", Url: setting.AppSubUrl + "/d/mongodb-wiredtiger/mongodb-wiredtiger-details", Icon: "sitemap", HideFromTabs: true},
	}

	mongodbChildNavs := []*dtos.NavLink{
		{Text: "HA (High availability)", Id: "home", Icon: "percona-cluster", HideFromTabs: true, Children: mongodbHAChildNavs},
		{Text: "MongoDB Overview", Id: "home", Url: setting.AppSubUrl + "/d/mongodb-instance-overview/mongodb-instances-overview", Icon: "percona-cluster-network", HideFromTabs: true},
		{Text: "MongoDB Summary", Id: "home", Url: setting.AppSubUrl + "/d/mongodb-instance-summary/mongodb-instance-summary", Icon: "percona-summary", HideFromTabs: true, Children: mongodbSummaryChildNavs},
	}

	postgresqlChildNavs := []*dtos.NavLink{
		// 		{Text: "HA (High availability)", Id: "home", Icon: "percona-cluster", HideFromTabs: true},
		{Text: "PostgreSQL Overview", Id: "home", Url: setting.AppSubUrl + "/d/postgresql-instance-overview/postgresql-instances-overview", Icon: "percona-cluster-network", HideFromTabs: true},
		{Text: "PostgreSQL Summary", Id: "home", Url: setting.AppSubUrl + "/d/postgresql-instance-summary/postgresql-instances-summary", Icon: "percona-summary", HideFromTabs: true},
	}

	// 	proxysqlHAChildNavs := []*dtos.NavLink{
	// 		{Text: "MySQL Group Replication Summary", Id: "home", Url: setting.AppSubUrl + "/d/mysql-group-replicaset-summary/mysql-group-replication-summary", Icon: "percona-cluster", HideFromTabs: true},
	// 		{Text: "MySQL Replication Summary", Id: "home", Url: setting.AppSubUrl + "/d/mysql-replicaset-summary/mysql-replication-summary", Icon: "percona-cluster", HideFromTabs: true},
	// 		{Text: "PXC/Galera Cluster Summary", Id: "home", Url: setting.AppSubUrl + "/d/pxc-cluster-summary/pxc-galera-cluster-summary", Icon: "percona-cluster", HideFromTabs: true},
	// 		{Text: "PXC/Galera Node Summary", Id: "home", Url: setting.AppSubUrl + "/d/pxc-node-summary/pxc-galera-node-summary", Icon: "percona-cluster", HideFromTabs: true},
	// 		{Text: "PXC/Galera Nodes Compare", Id: "home", Url: setting.AppSubUrl + "/d/pxc-nodes-compare/pxc-galera-nodes-compare", Icon: "percona-cluster", HideFromTabs: true},
	// 	}

	pmmChildNavs := []*dtos.NavLink{
		{Text: "Query Analytics", Id: "home", Url: setting.AppSubUrl + "/d/pmm-qan/pmm-query-analytics", Icon: "percona-analytics", HideFromTabs: true},
		{Text: "System (Node)", Id: "home", Url: setting.AppSubUrl + "/d/node-instance-overview/nodes-overview", Icon: "percona-cluster-network", HideFromTabs: true, Children: nodeChildNavs},
		{Text: "MySQL", Id: "home", Url: setting.AppSubUrl + "/d/mysql-instance-overview/mysql-instances-overview", Icon: "percona-database", HideFromTabs: true, Children: mysqlChildNavs},
		{Text: "MongoDB", Id: "home", Url: setting.AppSubUrl + "/d/mongodb-instance-overview/mongodb-instances-overview", Icon: "percona-database", HideFromTabs: true, Children: mongodbChildNavs},
		{Text: "PostgreSQL", Id: "home", Url: setting.AppSubUrl + "/d/postgresql-instance-overview/postgresql-instances-overview", Icon: "percona-database", HideFromTabs: true, Children: postgresqlChildNavs},
		{Text: "ProxySQL", Id: "home", Url: setting.AppSubUrl + "/d/proxysql-instance-summary/proxysql-instance-summary", Icon: "percona-database", HideFromTabs: true},
		{Text: "HAProxy", Id: "home", Url: setting.AppSubUrl + "/d/haproxy-instance-summary/haproxy-instance-summary", Icon: "percona-database", HideFromTabs: true},
	}

	dashboardChildNavs := []*dtos.NavLink{
		{Text: "Home", Id: "home", Url: setting.AppSubUrl + "/", Icon: "home-alt", HideFromTabs: true},
		{Text: "Divider", Divider: true, Id: "divider", HideFromTabs: true},
		{Text: "Manage", Id: "manage-dashboards", Url: setting.AppSubUrl + "/dashboards", Icon: "sitemap"},
		{Text: "Playlists", Id: "playlists", Url: setting.AppSubUrl + "/playlists", Icon: "presentation-play"},
	}

	if c.IsSignedIn {
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{
			Text: "Snapshots",
			Id:   "snapshots",
			Url:  setting.AppSubUrl + "/dashboard/snapshots",
			Icon: "camera",
		})
	}

	navTree = append(navTree, &dtos.NavLink{
		Text:       "Dashboards",
		Id:         "dashboards",
		SubTitle:   "Manage dashboards & folders",
		Icon:       "apps",
		Url:        setting.AppSubUrl + "/",
		SortWeight: dtos.WeightDashboard,
		Children:   dashboardChildNavs,
	})

	navTree = append(navTree, &dtos.NavLink{
		Text:       "PMM dashboards",
		Id:         "pmm",
		SubTitle:   "Manage dashboards & folders",
		Icon:       "percona-dashboard",
		Url:        setting.AppSubUrl + "/",
		SortWeight: dtos.WeightDashboard,
		Children:   pmmChildNavs,
	})

	if setting.ExploreEnabled && (c.OrgRole == models.ROLE_ADMIN || c.OrgRole == models.ROLE_EDITOR || setting.ViewersCanEdit) {
		navTree = append(navTree, &dtos.NavLink{
			Text:       "Explore",
			Id:         "explore",
			SubTitle:   "Explore your data",
			Icon:       "compass",
			SortWeight: dtos.WeightExplore,
			Url:        setting.AppSubUrl + "/explore",
		})
	}

	if c.IsSignedIn {
		navTree = append(navTree, getProfileNode(c))
	}

	if setting.AlertingEnabled && (c.OrgRole == models.ROLE_ADMIN || c.OrgRole == models.ROLE_EDITOR) {
		alertChildNavs := []*dtos.NavLink{
			{Text: "Alert Rules", Id: "alert-list", Url: setting.AppSubUrl + "/alerting/list", Icon: "list-ul"},
			{
				Text: "Notification channels", Id: "channels", Url: setting.AppSubUrl + "/alerting/notifications",
				Icon: "comment-alt-share",
			},
		}

		navTree = append(navTree, &dtos.NavLink{
			Text:       "Alerting",
			SubTitle:   "Alert rules & notifications",
			Id:         "alerting",
			Icon:       "bell",
			Url:        setting.AppSubUrl + "/alerting/list",
			Children:   alertChildNavs,
			SortWeight: dtos.WeightAlerting,
		})
	}

	appLinks, err := getAppLinks(c)
	if err != nil {
		return nil, err
	}
	navTree = append(navTree, appLinks...)

	configNodes := []*dtos.NavLink{}

	if c.OrgRole == models.ROLE_ADMIN || c.IsGrafanaAdmin {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:         "PMM Inventory",
			Icon:         "percona-inventory",
			Id:           "home",
			Url:          setting.AppSubUrl + "/inventory",
			HideFromTabs: true,
			Children:     inventoryChildNavs,
		})

		configNodes = append(configNodes, &dtos.NavLink{
			Text:         "Settings",
			Icon:         "percona-setting",
			Id:           "home",
			Url:          setting.AppSubUrl + "/settings",
			HideFromTabs: true,
		})

		configNodes = append(configNodes, &dtos.NavLink{
			Divider: true,
		})
	}

	if c.OrgRole == models.ROLE_ADMIN {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Data Sources",
			Icon:        "database",
			Description: "Add and configure data sources",
			Id:          "datasources",
			Url:         setting.AppSubUrl + "/datasources",
		})
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Users",
			Id:          "users",
			Description: "Manage org members",
			Icon:        "user",
			Url:         setting.AppSubUrl + "/org/users",
		})
	}

	if c.OrgRole == models.ROLE_ADMIN || (hs.Cfg.EditorsCanAdmin && c.OrgRole == models.ROLE_EDITOR) {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Teams",
			Id:          "teams",
			Description: "Manage org groups",
			Icon:        "users-alt",
			Url:         setting.AppSubUrl + "/org/teams",
		})
	}

	if c.OrgRole == models.ROLE_ADMIN {
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Plugins",
			Id:          "plugins",
			Description: "View and configure plugins",
			Icon:        "plug",
			Url:         setting.AppSubUrl + "/plugins",
		})

		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "Preferences",
			Id:          "org-settings",
			Description: "Organization preferences",
			Icon:        "sliders-v-alt",
			Url:         setting.AppSubUrl + "/org",
		})
		configNodes = append(configNodes, &dtos.NavLink{
			Text:        "API Keys",
			Id:          "apikeys",
			Description: "Create & manage API keys",
			Icon:        "key-skeleton-alt",
			Url:         setting.AppSubUrl + "/org/apikeys",
		})
	}

	if len(configNodes) > 0 {
		navTree = append(navTree, &dtos.NavLink{
			Id:         dtos.NavIDCfg,
			Text:       "Configuration",
			SubTitle:   "Organization: " + c.OrgName,
			Icon:       "cog",
			Url:        configNodes[0].Url,
			SortWeight: dtos.WeightConfig,
			Children:   configNodes,
		})
	}

	if c.IsGrafanaAdmin {
		adminNavLinks := []*dtos.NavLink{
			{Text: "Users", Id: "global-users", Url: setting.AppSubUrl + "/admin/users", Icon: "user"},
			{Text: "Orgs", Id: "global-orgs", Url: setting.AppSubUrl + "/admin/orgs", Icon: "building"},
			{Text: "Settings", Id: "server-settings", Url: setting.AppSubUrl + "/admin/settings", Icon: "sliders-v-alt"},
			{Text: "Stats", Id: "server-stats", Url: setting.AppSubUrl + "/admin/stats", Icon: "graph-bar"},
		}

		if hs.Cfg.LDAPEnabled {
			adminNavLinks = append(adminNavLinks, &dtos.NavLink{
				Text: "LDAP", Id: "ldap", Url: setting.AppSubUrl + "/admin/ldap", Icon: "book",
			})
		}

		navTree = append(navTree, &dtos.NavLink{
			Text:         "Server Admin",
			SubTitle:     "Manage all users & orgs",
			HideFromTabs: true,
			Id:           "admin",
			Icon:         "shield",
			Url:          setting.AppSubUrl + "/admin/users",
			SortWeight:   dtos.WeightAdmin,
			Children:     adminNavLinks,
		})
	}

	helpVersion := fmt.Sprintf(`%s v%s (%s)`, setting.ApplicationName, setting.BuildVersion, setting.BuildCommit)
	if hs.Cfg.AnonymousHideVersion && !c.IsSignedIn {
		helpVersion = setting.ApplicationName
	}

	navTree = append(navTree, &dtos.NavLink{
		Text:         "Help",
		SubTitle:     helpVersion,
		Id:           "help",
		Url:          "#",
		Icon:         "question-circle",
		HideFromMenu: true,
		SortWeight:   dtos.WeightHelp,
		Children:     []*dtos.NavLink{},
	})

	return navTree, nil
}

func (hs *HTTPServer) setIndexViewData(c *models.ReqContext) (*dtos.IndexViewData, error) {
	hasEditPermissionInFoldersQuery := models.HasEditPermissionInFoldersQuery{SignedInUser: c.SignedInUser}
	if err := bus.Dispatch(&hasEditPermissionInFoldersQuery); err != nil {
		return nil, err
	}
	hasEditPerm := hasEditPermissionInFoldersQuery.Result

	settings, err := hs.getFrontendSettingsMap(c)
	if err != nil {
		return nil, err
	}

	settings["dateFormats"] = hs.Cfg.DateFormats

	prefsQuery := models.GetPreferencesWithDefaultsQuery{User: c.SignedInUser}
	if err := bus.Dispatch(&prefsQuery); err != nil {
		return nil, err
	}
	prefs := prefsQuery.Result

	// Read locale from accept-language
	acceptLang := c.Req.Header.Get("Accept-Language")
	locale := "en-US"

	if len(acceptLang) > 0 {
		parts := strings.Split(acceptLang, ",")
		locale = parts[0]
	}

	appURL := setting.AppUrl
	appSubURL := setting.AppSubUrl

	// special case when doing localhost call from image renderer
	if c.IsRenderCall && !hs.Cfg.ServeFromSubPath {
		appURL = fmt.Sprintf("%s://localhost:%s", hs.Cfg.Protocol, setting.HttpPort)
		appSubURL = ""
		settings["appSubUrl"] = ""
	}

	navTree, err := hs.getNavTree(c, hasEditPerm)
	if err != nil {
		return nil, err
	}

	data := dtos.IndexViewData{
		User: &dtos.CurrentUser{
			Id:                         c.UserId,
			IsSignedIn:                 c.IsSignedIn,
			Login:                      c.Login,
			Email:                      c.Email,
			Name:                       c.Name,
			OrgCount:                   c.OrgCount,
			OrgId:                      c.OrgId,
			OrgName:                    c.OrgName,
			OrgRole:                    c.OrgRole,
			GravatarUrl:                dtos.GetGravatarUrl(c.Email),
			IsGrafanaAdmin:             c.IsGrafanaAdmin,
			LightTheme:                 prefs.Theme == lightName,
			Timezone:                   prefs.Timezone,
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
		NewGrafanaVersion:       hs.PluginManager.GrafanaLatestVersion,
		NewGrafanaVersionExists: hs.PluginManager.GrafanaHasUpdate,
		AppName:                 setting.ApplicationName,
		AppNameBodyClass:        getAppNameBodyClass(hs.License.HasValidLicense()),
		FavIcon:                 "public/img/fav32.png",
		AppleTouchIcon:          "public/img/apple-touch-icon.png",
		AppTitle:                "Grafana",
		NavTree:                 navTree,
		Sentry:                  &hs.Cfg.Sentry,
		Nonce:                   c.RequestNonce,
		ContentDeliveryURL:      hs.Cfg.GetContentDeliveryURL(hs.License.ContentDeliveryPrefix()),
	}

	if setting.DisableGravatar {
		data.User.GravatarUrl = setting.AppSubUrl + "/public/img/user_profile.png"
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
	c.HTML(200, "index", data)
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

func getAppNameBodyClass(validLicense bool) string {
	if validLicense {
		return "app-enterprise"
	}

	return "app-grafana"
}
