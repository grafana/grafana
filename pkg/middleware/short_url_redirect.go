package middleware

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"gopkg.in/macaron.v1"
)

func ShortURLRedirect() macaron.Handler {
	return func(c *models.ReqContext) {
		shortURLUID := c.Params(":uid")

		if !util.IsValidShortUID(shortURLUID) {
			return
		}

		service := shorturls.NewShortURLService(c.SignedInUser)
		path, err := service.GetFullURLByUID(shortURLUID)
		if err != nil {
			return
		}
		c.Redirect(setting.ToAbsUrl(path), 302)
	}
}
