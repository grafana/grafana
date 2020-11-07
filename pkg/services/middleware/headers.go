package middleware

import (
	"github.com/grafana/grafana/pkg/models"
)

const HeaderNameNoBackendCache = "X-Grafana-NoCache"

func (s *MiddlewareService) HandleNoCacheHeader(ctx *models.ReqContext) {
	ctx.SkipCache = ctx.Req.Header.Get(HeaderNameNoBackendCache) == "true"
}
