package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// OrgRedirect changes org and redirects users if the
// querystring `orgId` doesn't match the active org.
func OrgRedirect(cfg *setting.Cfg) web.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *web.Context) {
		orgIdValue := req.URL.Query().Get("orgId")
		orgId, err := strconv.ParseInt(orgIdValue, 10, 64)

		if err != nil || orgId == 0 {
			return
		}

		ctx := contexthandler.FromContext(req.Context())
		if !ctx.IsSignedIn {
			return
		}

		if orgId == ctx.OrgId {
			return
		}

		cmd := models.SetUsingOrgCommand{UserId: ctx.UserId, OrgId: orgId}
		if err := bus.DispatchCtx(ctx.Req.Context(), &cmd); err != nil {
			if ctx.IsApiRequest() {
				ctx.JsonApiErr(404, "Not found", nil)
			} else {
				http.Error(ctx.Resp, "Not found", http.StatusNotFound)
			}

			return
		}

		var queryString string = c.Req.URL.Query().Encode()
		if strings.Contains(queryString, "kiosk=") && !strings.Contains(queryString, "kiosk=tv") {
			queryString = strings.Replace(queryString, "kiosk=", "kiosk", -1)
		}

		newURL := fmt.Sprintf("%s%s?%s", cfg.AppURL, strings.TrimPrefix(c.Req.URL.Path, "/"), queryString)

		c.Redirect(newURL, 302)
	}
}
