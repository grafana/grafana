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
			hostRedirectCounter.Inc()
			c.Logger.Info("Enforcing Host header", "hosted", c.Req.Host, "expected", cfg.Domain)
			c.Redirect(strings.TrimSuffix(cfg.AppURL, "/")+c.Req.RequestURI, 301)
			return
		}
	}
}
