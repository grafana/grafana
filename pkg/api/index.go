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

	dashboardChildNavs := []*dtos.NavLink{
		{Text: "Home", Url: setting.AppSubUrl + "/"},
		{Text: "Playlists", Url: setting.AppSubUrl + "/playlists"},
		{Text: "Snapshots", Url: setting.AppSubUrl + "/dashboard/snapshots"},
	}

	if c.OrgRole == m.ROLE_ADMIN || c.OrgRole == m.ROLE_EDITOR {
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{Divider: true})
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{Text: "New", Icon: "fa fa-plus", Url: setting.AppSubUrl + "/dashboard/new"})
		dashboardChildNavs = append(dashboardChildNavs, &dtos.NavLink{Text: "Import", Icon: "fa fa-download", Url: setting.AppSubUrl + "/dashboard/new/?editview=import"})
	}

	data.MainNavLinks = append(data.MainNavLinks, &dtos.NavLink{
		Text:     "Dashboards",
		Icon:     "icon-gf icon-gf-dashboard",
		Url:      setting.AppSubUrl + "/",
		Children: dashboardChildNavs,
	})

	if setting.AlertingEnabled && (c.OrgRole == m.ROLE_ADMIN || c.OrgRole == m.ROLE_EDITOR) {
		alertChildNavs := []*dtos.NavLink{
			{Text: "Alert List", Url: setting.AppSubUrl + "/alerting/list"},
			{Text: "Notification channels", Url: setting.AppSubUrl + "/alerting/notifications"},
		}

		data.MainNavLinks = append(data.MainNavLinks, &dtos.NavLink{
			Text:     "Alerting",
			Icon:     "icon-gf icon-gf-alert",
			Url:      setting.AppSubUrl + "/alerting/list",
			Children: alertChildNavs,
		})
	}

	if c.OrgRole == m.ROLE_ADMIN {
		data.MainNavLinks = append(data.MainNavLinks, &dtos.NavLink{
			Text: "Data Sources",
			Icon: "icon-gf icon-gf-datasources",
			Url:  setting.AppSubUrl + "/datasources",
		})

		data.MainNavLinks = append(data.MainNavLinks, &dtos.NavLink{
			Text: "Plugins",
			Icon: "icon-gf icon-gf-apps",
			Url:  setting.AppSubUrl + "/plugins",
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
				data.MainNavLinks = append(data.MainNavLinks, appLink)
			}
		}
	}

	if c.IsGrafanaAdmin {
		data.MainNavLinks = append(data.MainNavLinks, &dtos.NavLink{
			Text: "Admin",
			Icon: "fa fa-fw fa-cogs",
			Url:  setting.AppSubUrl + "/admin",
			Children: []*dtos.NavLink{
				{Text: "Global Users", Url: setting.AppSubUrl + "/admin/users"},
				{Text: "Global Orgs", Url: setting.AppSubUrl + "/admin/orgs"},
				{Text: "Server Settings", Url: setting.AppSubUrl + "/admin/settings"},
				{Text: "Server Stats", Url: setting.AppSubUrl + "/admin/stats"},
			},
		})
	}

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
