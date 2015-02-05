package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/setting"
)

func setIndexViewData(c *middleware.Context) error {
	settings, err := getFrontendSettings(c)
	if err != nil {
		return err
	}

	currentUser := &dtos.CurrentUser{
		IsSignedIn:     c.IsSignedIn,
		Login:          c.Login,
		Email:          c.Email,
		Name:           c.Name,
		AccountName:    c.AccountName,
		AccountRole:    c.AccountRole,
		GravatarUrl:    dtos.GetGravatarUrl(c.Email),
		IsGrafanaAdmin: c.IsGrafanaAdmin,
	}

	if len(currentUser.Name) == 0 {
		currentUser.Name = currentUser.Login
	}

	c.Data["User"] = currentUser
	c.Data["Settings"] = settings
	c.Data["AppUrl"] = setting.AppUrl
	c.Data["AppSubUrl"] = setting.AppSubUrl

	return nil
}

func Index(c *middleware.Context) {
	if err := setIndexViewData(c); err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	}

	c.HTML(200, "index")
}

func NotFound(c *middleware.Context) {
	if c.IsApiRequest() {
		c.JsonApiErr(200, "Not found", nil)
		return
	}

	if err := setIndexViewData(c); err != nil {
		c.Handle(500, "Failed to get settings", err)
		return
	}

	c.HTML(404, "index")
}
