package middleware

import (
	"strings"

	"github.com/grafana/grafana/pkg/models"
)

func (s *MiddlewareService) ValidateHostHeader(c *models.ReqContext) {
	// ignore local render calls
	if c.IsRenderCall {
		return
	}

	h := c.Req.Host
	if i := strings.Index(h, ":"); i >= 0 {
		h = h[:i]
	}

	if !strings.EqualFold(h, s.Cfg.Domain) {
		c.Redirect(strings.TrimSuffix(s.Cfg.AppURL, "/")+c.Req.RequestURI, 301)
		return
	}
}
