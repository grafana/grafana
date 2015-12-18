package api

import (
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
		Href: "/",
	})

	orgApps := m.GetAppPluginsQuery{OrgId: c.OrgId}
	err = bus.Dispatch(&orgApps)
	if err != nil {
		return nil, err
	}
	enabledPlugins := plugins.GetEnabledPlugins(orgApps.Result)

	for _, plugin := range enabledPlugins.AppPlugins {
		for _, js := range plugin.Js {
			data.PluginJs = append(data.PluginJs, js.Module)
		}
		for _, css := range plugin.Css {
			data.PluginCss = append(data.PluginCss, &dtos.PluginCss{Light: css.Light, Dark: css.Dark})
		}
		for _, item := range plugin.MainNavLinks {
			// only show menu items for the specified roles.
			var validRoles []m.RoleType
			if string(item.ReqRole) == "" || item.ReqRole == m.ROLE_VIEWER {
				validRoles = []m.RoleType{m.ROLE_ADMIN, m.ROLE_EDITOR, m.ROLE_VIEWER}
			} else if item.ReqRole == m.ROLE_EDITOR {
				validRoles = []m.RoleType{m.ROLE_ADMIN, m.ROLE_EDITOR}
			} else if item.ReqRole == m.ROLE_ADMIN {
				validRoles = []m.RoleType{m.ROLE_ADMIN}
			}
			ok := true
			if len(validRoles) > 0 {
				ok = false
				for _, role := range validRoles {
					if role == c.OrgRole {
						ok = true
						break
					}
				}
			}
			if ok {
				data.MainNavLinks = append(data.MainNavLinks, &dtos.NavLink{Text: item.Text, Href: item.Href, Icon: item.Icon})
			}
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
