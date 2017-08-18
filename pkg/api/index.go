package api

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

func setIndexViewData(c *middleware.Context) (*dtos.IndexViewData, error) {
	settings, err := getFrontendSettingsMap(c)
	if err != nil {
		return nil, err
	}

	prefsQuery := m.GetPreferencesWithDefaultsQuery{OrgId: c.OrgId, UserId: c.UserId}
	if err := bus.Dispatch(&prefsQuery); err != nil {
		return nil, err
	}
	prefs := prefsQuery.Result

	// Read locale from acccept-language
	acceptLang := c.Req.Header.Get("Accept-Language")
	locale := "en-US"

	if len(acceptLang) > 0 {
		parts := strings.Split(acceptLang, ",")
		locale = parts[0]
	}

	appUrl := setting.AppUrl
	appSubUrl := setting.AppSubUrl

	// special case when doing localhost call from phantomjs
	if c.IsRenderCall {
		appUrl = fmt.Sprintf("%s://localhost:%s", setting.Protocol, setting.HttpPort)
		appSubUrl = ""
		settings["appSubUrl"] = ""
	}

	var data = dtos.IndexViewData{
		User: &dtos.CurrentUser{
			Id:             c.UserId,
			IsSignedIn:     c.IsSignedIn,
			Login:          c.Login,
			Email:          c.Email,
			Name:           c.Name,
			OrgCount:       c.OrgCount,
			OrgId:          c.OrgId,
			OrgName:        c.OrgName,
			OrgRole:        c.OrgRole,
			GravatarUrl:    dtos.GetGravatarUrl(c.Email),
			IsGrafanaAdmin: c.IsGrafanaAdmin,
			LightTheme:     prefs.Theme == "light",
			Timezone:       prefs.Timezone,
			Locale:         locale,
			HelpFlags1:     c.HelpFlags1,
		},
		Settings:                settings,
		AppUrl:                  appUrl,
		AppSubUrl:               appSubUrl,
		GoogleAnalyticsId:       setting.GoogleAnalyticsId,
		GoogleTagManagerId:      setting.GoogleTagManagerId,
		BuildVersion:            setting.BuildVersion,
		BuildCommit:             setting.BuildCommit,
		NewGrafanaVersion:       plugins.GrafanaLatestVersion,
		NewGrafanaVersionExists: plugins.GrafanaHasUpdate,
	}

	if setting.DisableGravatar {
		data.User.GravatarUrl = setting.AppSubUrl + "/public/img/transparent.png"
	}

	if len(data.User.Name) == 0 {
		data.User.Name = data.User.Login
	}

	themeUrlParam := c.Query("theme")
	if themeUrlParam == "light" {
		data.User.LightTheme = true
	}

	if c.OrgRole == m.ROLE_ADMIN || c.OrgRole == m.ROLE_EDITOR {
		data.NavTree = append(data.NavTree, &dtos.NavLink{
			Text: "Create",
			Icon: "fa fa-fw fa-plus",
			Url:  "#",
			Children: []*dtos.NavLink{
				{Text: "Dashboard", Icon: "fa fa-fw fa-plus", Url: setting.AppSubUrl + "/dashboard/new"},
				{Text: "Folder", Icon: "fa fa-fw fa-plus", Url: setting.AppSubUrl + "/dashboard/new/?editview=new-folder"},
				{Text: "Import", Icon: "fa fa-fw fa-plus", Url: setting.AppSubUrl + "/dashboard/new/?editview=import"},
			},
		})
	}

	dashboardChildNavs := []*dtos.NavLink{
		{Text: "Home", Url: setting.AppSubUrl + "/", Icon: "fa fa-fw fa-home"},
		{Text: "Playlists", Id: "playlists", Url: setting.AppSubUrl + "/playlists", Icon: "fa fa-fw fa-film"},
		{Text: "Snapshots", Id: "snapshots", Url: setting.AppSubUrl + "/dashboard/snapshots", Icon: "icon-gf icon-gf-snapshot"},
	}

	data.NavTree = append(data.NavTree, &dtos.NavLink{
		Text:     "Dashboards",
		Id:       "dashboards",
		Icon:     "icon-gf icon-gf-dashboard",
		Url:      setting.AppSubUrl + "/",
		Children: dashboardChildNavs,
	})

	if c.IsSignedIn {
		profileNode := &dtos.NavLink{
			Text:         c.SignedInUser.Login,
			Id:           "profile",
			Img:          data.User.GravatarUrl,
			Url:          setting.AppSubUrl + "/profile",
			HideFromMenu: true,
			Children: []*dtos.NavLink{
				{Text: "Your profile", Url: setting.AppSubUrl + "/profile", Icon: "fa fa-fw fa-sliders"},
				{Text: "Change Password", Id: "change-password", Url: setting.AppSubUrl + "/profile/password", Icon: "fa fa-fw fa-lock", HideFromMenu: true},
			},
		}

		if !setting.DisableSignoutMenu {
			// add sign out first
			profileNode.Children = append([]*dtos.NavLink{
				{Text: "Sign out", Url: setting.AppSubUrl + "/logout", Icon: "fa fa-fw fa-sign-out", Target: "_self"},
			}, profileNode.Children...)
		}

		data.NavTree = append(data.NavTree, profileNode)
	}

	if setting.AlertingEnabled && (c.OrgRole == m.ROLE_ADMIN || c.OrgRole == m.ROLE_EDITOR) {
		alertChildNavs := []*dtos.NavLink{
			{Text: "Alert List", Id: "alert-list", Url: setting.AppSubUrl + "/alerting/list", Icon: "fa fa-fw fa-list-ul"},
			{Text: "Notification channels", Id: "channels", Url: setting.AppSubUrl + "/alerting/notifications", Icon: "fa fa-fw fa-bell-o"},
		}

		data.NavTree = append(data.NavTree, &dtos.NavLink{
			Text:     "Alerting",
			Id:       "alerting",
			Icon:     "icon-gf icon-gf-alert",
			Url:      setting.AppSubUrl + "/alerting/list",
			Children: alertChildNavs,
		})
	}

	enabledPlugins, err := plugins.GetEnabledPlugins(c.OrgId)
	if err != nil {
		return nil, err
	}

	for _, plugin := range enabledPlugins.Apps {
		if plugin.Pinned {
			appLink := &dtos.NavLink{
				Text: plugin.Name,
				Id:   "plugin-page-" + plugin.Id,
				Url:  plugin.DefaultNavUrl,
				Img:  plugin.Info.Logos.Small,
			}

			for _, include := range plugin.Includes {
				if !c.HasUserRole(include.Role) {
					continue
				}

				if include.Type == "page" && include.AddToNav {
					link := &dtos.NavLink{
						Url:  setting.AppSubUrl + "/plugins/" + plugin.Id + "/page/" + include.Slug,
						Text: include.Name,
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

			if len(appLink.Children) > 0 && c.OrgRole == m.ROLE_ADMIN {
				appLink.Children = append(appLink.Children, &dtos.NavLink{Divider: true})
				appLink.Children = append(appLink.Children, &dtos.NavLink{Text: "Plugin Config", Icon: "fa fa-cog", Url: setting.AppSubUrl + "/plugins/" + plugin.Id + "/edit"})
			}

			if len(appLink.Children) > 0 {
				data.NavTree = append(data.NavTree, appLink)
			}
		}
	}

	if c.OrgRole == m.ROLE_ADMIN {
		cfgNode := &dtos.NavLink{
			Id:   "cfg",
			Text: "Configuration",
			Icon: "fa fa-fw fa-cogs",
			Url:  setting.AppSubUrl + "/configuration",
			Children: []*dtos.NavLink{
				{
					Text:        "Data Sources",
					Icon:        "icon-gf icon-gf-datasources",
					Description: "Add and configure data sources",
					Id:          "datasources",
					Url:         setting.AppSubUrl + "/datasources",
					Children: []*dtos.NavLink{
						{Text: "List", Url: setting.AppSubUrl + "/datasources", Icon: "icon-gf icon-gf-datasources"},
						{Text: "New", Url: setting.AppSubUrl + "/datasources", Icon: "fa fa-fw fa-plus"},
					},
				},
				{
					Text:        "Preferences",
					Id:          "org",
					Description: "Organization preferences",
					Icon:        "fa fa-fw fa-sliders",
					Url:         setting.AppSubUrl + "/org",
				},
				{
					Text:        "Plugins",
					Id:          "plugins",
					Description: "View and configure plugins",
					Icon:        "icon-gf icon-gf-apps",
					Url:         setting.AppSubUrl + "/plugins",
					Children: []*dtos.NavLink{
						{Text: "Panels", Url: setting.AppSubUrl + "/plugins?type=panel", Icon: "fa fa-fw fa-stop"},
						{Text: "Data sources", Url: setting.AppSubUrl + "/plugins?type=datasource", Icon: "icon-gf icon-gf-datasources"},
						{Text: "Apps", Url: setting.AppSubUrl + "/plugins?type=app", Icon: "icon-gf icon-gf-apps"},
					},
				},
				{
					Text:        "Members",
					Id:          "users",
					Description: "Manage org members",
					Icon:        "icon-gf icon-gf-users",
					Url:         setting.AppSubUrl + "/org/users",
				},
				{
					Text:        "Groups",
					Id:          "users",
					Description: "Manage org groups",
					Icon:        "fa fa-fw fa-users",
					Url:         setting.AppSubUrl + "/org/user-groups",
				},
				{
					Text:        "API Keys",
					Id:          "apikeys",
					Description: "Create & manage API keys",
					Icon:        "fa fa-fw fa-key",
					Url:         setting.AppSubUrl + "/org/apikeys",
				},
			},
		}

		if c.IsGrafanaAdmin {
			cfgNode.Children = append(cfgNode.Children, &dtos.NavLink{
				Text: "Server Admin",
				Id:   "admin",
				Icon: "fa fa-fw fa-shield",
				Url:  setting.AppSubUrl + "/admin",
				Children: []*dtos.NavLink{
					{Text: "Global Users", Id: "global-users", Url: setting.AppSubUrl + "/admin/users"},
					{Text: "Global Orgs", Id: "global-orgs", Url: setting.AppSubUrl + "/admin/orgs"},
					{Text: "Server Settings", Id: "server-settings", Url: setting.AppSubUrl + "/admin/settings"},
					{Text: "Server Stats", Id: "server-stats", Url: setting.AppSubUrl + "/admin/stats"},
					{Text: "Style Guide", Id: "styleguide", Url: setting.AppSubUrl + "/admin/styleguide"},
				},
			})
		}

		data.NavTree = append(data.NavTree, cfgNode)
	}

	data.NavTree = append(data.NavTree, &dtos.NavLink{
		Text:         "Help",
		Id:           "help",
		Url:          "#",
		Icon:         "fa fa-fw fa-question",
		HideFromMenu: true,
		Children: []*dtos.NavLink{
			{Text: "Keyboard shortcuts", Url: "/shortcuts", Icon: "fa fa-fw fa-keyboard-o", Target: "_self"},
			{Text: "Community site", Url: "http://community.grafana.com", Icon: "fa fa-fw fa-comment", Target: "_blank"},
			{Text: "Documentation", Url: "http://docs.grafana.org", Icon: "fa fa-fw fa-file", Target: "_blank"},
		},
	})

	return &data, nil
}

func Index(c *middleware.Context) {
	if data, err := setIndexViewData(c); err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	} else {
		c.HTML(200, "index", data)
	}
}

func NotFoundHandler(c *middleware.Context) {
	if c.IsApiRequest() {
		c.JsonApiErr(404, "Not found", nil)
		return
	}

	if data, err := setIndexViewData(c); err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	} else {
		c.HTML(404, "index", data)
	}
}
