package middleware

import (
	"github.com/grafana/grafana/pkg/models"
	macaron "gopkg.in/macaron.v1"
)

const HeaderNameNoBackendCache = "X-Grafana-NoCache"

func HandleNoCacheHeader() macaron.Handler {
	return func(ctx *models.ReqContext) {
		ctx.SkipCache = ctx.Req.Header.Get(HeaderNameNoBackendCache) == "true"
	}
}
