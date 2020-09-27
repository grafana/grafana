package middleware

import (
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"gopkg.in/macaron.v1"
)

func ShortUrlRedirect() macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		shortUrlUid := c.Params(":uid")
		ctx := c.Data["ctx"].(*models.ReqContext)

		if !util.IsValidShortUID(c.Params(":uid")) {
			return
		}

		cmd := models.GetFullUrlQuery{OrgId: ctx.OrgId, Uid: shortUrlUid}
		if err := bus.Dispatch(&cmd); err != nil {
			return
		}
		c.Redirect(setting.ToAbsUrl(strings.TrimPrefix(cmd.Result.Path, "/")), 302)
	}
}
