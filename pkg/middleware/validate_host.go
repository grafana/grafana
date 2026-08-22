package middleware

import (
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var (
	hostRedirectCounter = promauto.NewCounter(prometheus.CounterOpts{
		Name:      "host_redirect_total",
		Help:      "Number of requests redirected due to host header mismatch",
		Namespace: "grafana",
	})
)

func ValidateHostHeader(cfg *setting.Cfg) web.Handler {
	return func(c *contextmodel.ReqContext) {
		// ignore local render calls
		if c.IsRenderCall {
			return
		}

		h := c.Req.Host
		if i := strings.Index(h, ":"); i >= 0 {
			h = h[:i]
		}

		if !strings.EqualFold(h, cfg.Domain) {
			// the normal redirecting logic doesn't work when running as frontend service, since it has no knowledge of the custom domain.
			// instead, we modify the single tenant `/bootdata` call with a 204 response and a header indicating the domain to redirect to
			// this is safe because only the frontend service calls `/bootdata`
			// the redirect is then handled client side.
			// see pkg/services/frontend/index.html
			if c.Req.URL.Path == "/bootdata" {
				c.Resp.Header().Set("Redirect-Domain", cfg.Domain)
				c.Resp.WriteHeader(204)
				return
			}
			hostRedirectCounter.Inc()
			c.Logger.Info("Enforcing Host header", "hosted", c.Req.Host, "expected", cfg.Domain)
			// With serve_from_sub_path enabled the request URI still contains the sub path
			// (only the router-facing URL.Path has it stripped), while AppURL already ends
			// with it — strip it so the redirect doesn't duplicate the sub path.
			requestURI := c.Req.RequestURI
			if cfg.AppSubURL != "" {
				requestURI = strings.TrimPrefix(requestURI, cfg.AppSubURL)
			}
			c.Redirect(strings.TrimSuffix(cfg.AppURL, "/")+requestURI, 301)
			return
		}
	}
}
