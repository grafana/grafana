package middleware

import (
	"fmt"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// Only allow redirects that start with an alphanumerical character, a dash or an underscore.
var redirectRe = regexp.MustCompile(`^/?[a-zA-Z0-9-_].*`)

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

		if !validRedirectPath(c.Req.URL.Path) {
			// Do not switch orgs or perform the redirect because the new path is not valid
			return
		}

		if err := userSvc.Update(ctx.Req.Context(), &user.UpdateUserCommand{UserID: ctx.UserID, OrgID: &orgId}); err != nil {
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

func validRedirectPath(p string) bool {
	cleanPath := path.Clean(p)
	return cleanPath == "." || cleanPath == "/" || redirectRe.MatchString(cleanPath)
}
