package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// Redirects URLs that are missing the configured subpath to an URL that contains the subpath.
func SubPathRedirect(cfg *setting.Cfg) web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			// Direct to url with subpath if the request is missing the subpath and is not an API request.
			if !strings.HasPrefix(req.RequestURI, cfg.AppSubURL) && !strings.HasPrefix(req.RequestURI, "/api") {
				newURL := fmt.Sprintf("%s%s", cfg.AppURL, strings.TrimPrefix(req.RequestURI, "/"))
				http.Redirect(rw, req, newURL, 301)
				return
			}

			next.ServeHTTP(rw, req)
		})
	}
}
