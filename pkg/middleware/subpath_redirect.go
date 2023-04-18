package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// Redirects URLs that are missing the configured subpath to an URL that contains the subpath.
func SubPathRedirect(cfg *setting.Cfg) web.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *web.Context) {
		if !strings.HasPrefix(req.RequestURI, cfg.AppSubURL) {
			newURL := fmt.Sprintf("%s%s", cfg.AppURL, strings.TrimPrefix(req.RequestURI, "/"))
			c.Redirect(newURL, 301)
		}
	}
}
