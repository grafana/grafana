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
		{
			Text: "Change Password", Id: "change-password", Url: setting.AppSubUrl + "/profile/password",
			Icon: "lock", HideFromMenu: true,
		},
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

		if len(appLink.Children) > 0 && c.OrgRole == models.ROLE_ADMIN {
			appLink.Children = append(appLink.Children, &dtos.NavLink{Divider: true})
			appLink.Children = append(appLink.Children, &dtos.NavLink{
				Text: "Plugin Config", Icon: "cog", Url: setting.AppSubUrl + "/plugins/" + plugin.Id + "/",
			})
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

	dashboardChildNavs := []*dtos.NavLink{
		{Text: "Home", Id: "home", Url: setting.AppSubUrl + "/", Icon: "home-alt", HideFromTabs: true},
		{Text: "Divider", Divider: true, Id: "divider", HideFromTabs: true},
		{Text: "Manage", Id: "manage-dashboards", Url: setting.AppSubUrl + "/dashboards", Icon: "sitemap"},
		{Text: "Playlists", Id: "playlists", Url: setting.AppSubUrl + "/playlists", Icon: "presentation-play"},
		{Text: "Snapshots", Id: "snapshots", Url: setting.AppSubUrl + "/dashboard/snapshots", Icon: "camera"},
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
			Id:         "cfg",
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

		if setting.LDAPEnabled {
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
		appURL = fmt.Sprintf("%s://localhost:%s", setting.Protocol, setting.HttpPort)
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
		NewGrafanaVersion:       plugins.GrafanaLatestVersion,
		NewGrafanaVersionExists: plugins.GrafanaHasUpdate,
		AppName:                 setting.ApplicationName,
		AppNameBodyClass:        getAppNameBodyClass(hs.License.HasValidLicense()),
		FavIcon:                 "public/img/fav32.png",
		AppleTouchIcon:          "public/img/apple-touch-icon.png",
		AppTitle:                "Grafana",
		NavTree:                 navTree,
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
		c.Handle(500, "Failed to get settings", err)
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
		c.Handle(500, "Failed to get settings", err)
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
