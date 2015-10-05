package middleware

import (
	"strings"

	"github.com/Unknwon/macaron"
	"github.com/Cepave/grafana/pkg/setting"
)

func ValidateHostHeader(domain string) macaron.Handler {
	return func(c *macaron.Context) {
		h := c.Req.Host
		if i := strings.Index(h, ":"); i >= 0 {
			h = h[:i]
		}

		if !strings.EqualFold(h, domain) {
			c.Redirect(strings.TrimSuffix(setting.AppUrl, "/")+c.Req.RequestURI, 301)
			return
		}
	}
}
