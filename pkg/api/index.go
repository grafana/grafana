package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/setting"
)

func setIndexViewData(c *middleware.Context) error {
	settings, err := getFrontendSettingsMap(c)
	if err != nil {
		return err
	}

	currentUser := &dtos.CurrentUser{
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
	}

	if setting.DisableGravatar {
		currentUser.GravatarUrl = setting.AppSubUrl + "/img/user_profile.png"
	}

	if len(currentUser.Name) == 0 {
		currentUser.Name = currentUser.Login
	}

	themeUrlParam := c.Query("theme")
	if themeUrlParam == "light" {
		currentUser.LightTheme = true
	}

	c.Data["User"] = currentUser
	c.Data["Settings"] = settings
	c.Data["AppUrl"] = setting.AppUrl
	c.Data["AppSubUrl"] = setting.AppSubUrl

	if setting.GoogleAnalyticsId != "" {
		c.Data["GoogleAnalyticsId"] = setting.GoogleAnalyticsId
	}

	if setting.GoogleTagManagerId != "" {
		c.Data["GoogleTagManagerId"] = setting.GoogleTagManagerId
	}

	return nil
}

func Index(c *middleware.Context) {
	if err := setIndexViewData(c); err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	}

	c.HTML(200, "index")
}

func NotFoundHandler(c *middleware.Context) {
	if c.IsApiRequest() {
		c.JsonApiErr(404, "Not found", nil)
		return
	}

	if err := setIndexViewData(c); err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	}

	c.HTML(404, "index")
}
