package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
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

	var data = dtos.IndexViewData{
		User: &dtos.CurrentUser{
			Id:             c.UserId,
			IsSignedIn:     c.IsSignedIn,
			Login:          c.Login,
			Email:          c.Email,
			Name:           c.Name,
			LightTheme:     c.Theme == "light",
			OrgId:          c.OrgId,
			OrgName:        c.OrgName,
			OrgRole:        c.OrgRole,
			GravatarUrl:    dtos.GetGravatarUrl(c.Email),
			IsGrafanaAdmin: c.IsGrafanaAdmin,
		},
		Settings:           settings,
		AppUrl:             setting.AppUrl,
		AppSubUrl:          setting.AppSubUrl,
		GoogleAnalyticsId:  setting.GoogleAnalyticsId,
		GoogleTagManagerId: setting.GoogleTagManagerId,
	}

	if setting.DisableGravatar {
		data.User.GravatarUrl = setting.AppSubUrl + "/img/user_profile.png"
	}

	if len(data.User.Name) == 0 {
		data.User.Name = data.User.Login
	}

	themeUrlParam := c.Query("theme")
	if themeUrlParam == "light" {
		data.User.LightTheme = true
	}

	data.MainNavLinks = append(data.MainNavLinks, &dtos.NavLink{
		Text: "Dashboards",
		Icon: "fa fa-fw fa-th-large",
		Url:  "/",
	})

	data.MainNavLinks = append(data.MainNavLinks, &dtos.NavLink{
		Text: "Playlists",
		Icon: "fa fa-fw fa-list",
		Url:  "/playlists",
	})

	if c.OrgRole == m.ROLE_ADMIN {
		data.MainNavLinks = append(data.MainNavLinks, &dtos.NavLink{
			Text: "Data Sources",
			Icon: "fa fa-fw fa-database",
			Url:  "/datasources",
		})

		data.MainNavLinks = append(data.MainNavLinks, &dtos.NavLink{
			Text: "Apps",
			Icon: "fa fa-fw fa-cubes",
			Url:  "/apps",
		})
	}

	enabledPlugins, err := plugins.GetEnabledPlugins(c.OrgId)
	if err != nil {
		return nil, err
	}

	for _, plugin := range enabledPlugins.Apps {
		if plugin.Module != "" {
			data.PluginModules = append(data.PluginModules, plugin.Module)
		}

		if plugin.Css != nil {
			data.PluginCss = append(data.PluginCss, &dtos.PluginCss{Light: plugin.Css.Light, Dark: plugin.Css.Dark})
		}

		if plugin.Pinned {
			data.MainNavLinks = append(data.MainNavLinks, &dtos.NavLink{
				Text: plugin.Name,
				Url:  "/apps/edit/" + plugin.Id,
				Img:  plugin.Info.Logos.Small,
			})
		}
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
