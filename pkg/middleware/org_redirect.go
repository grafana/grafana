package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// OrgRedirect changes org and redirects users if the
// querystring `orgId` doesn't match the active org.
func OrgRedirect(cfg *setting.Cfg, userSvc user.Service) web.Handler {
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

		if orgId == ctx.OrgID {
			return
		}

		cmd := user.SetUsingOrgCommand{UserID: ctx.UserID, OrgID: orgId}
		if err := userSvc.SetUsingOrg(ctx.Req.Context(), &cmd); err != nil {
			if ctx.IsApiRequest() {
				ctx.JsonApiErr(404, "Not found", nil)
			} else {
				http.Error(ctx.Resp, "Not found", http.StatusNotFound)
			}

			return
		}

		urlParams := c.Req.URL.Query()
		qs := urlParams.Encode()

		if urlParams.Has("kiosk") && urlParams.Get("kiosk") == "" {
			urlParams.Del("kiosk")
			qs = fmt.Sprintf("%s&kiosk", urlParams.Encode())
		}

		newURL := fmt.Sprintf("%s%s?%s", cfg.AppURL, strings.TrimPrefix(c.Req.URL.Path, "/"), qs)

		c.Redirect(newURL, 302)
	}
}
