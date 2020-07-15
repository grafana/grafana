package middleware

import (
	"net/http"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/unrolled/secure"
	macaron "gopkg.in/macaron.v1"
)

const HeaderNameNoBackendCache = "X-Grafana-NoCache"

func HandleNoCacheHeader() macaron.Handler {
	return func(ctx *models.ReqContext) {
		ctx.SkipCache = ctx.Req.Header.Get(HeaderNameNoBackendCache) == "true"
	}
}

func AddSeceureResponseHeaders() macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		secureMiddleware := secure.New(createSecureOptions())

		nonce, _ := secureMiddleware.ProcessAndReturnNonce(res, req)
		ctx, ok := c.Data["ctx"].(*models.ReqContext)
		if !ok {
			return
		}

		ctx.RequestNonce = nonce
	}
}

func createSecureOptions() secure.Options {
	secureOptions := secure.Options{
		ContentTypeNosniff: setting.ContentTypeProtectionHeader,
		BrowserXssFilter:   setting.XSSProtectionHeader,
		FrameDeny:          !setting.AllowEmbedding,
		ForceSTSHeader:     (setting.Protocol == setting.HTTPS || setting.Protocol == setting.HTTP2) && setting.StrictTransportSecurity,
	}

	if secureOptions.ForceSTSHeader {
		secureOptions.STSSeconds = int64(setting.StrictTransportSecurityMaxAge)
		secureOptions.STSPreload = setting.StrictTransportSecurityPreload
		secureOptions.STSIncludeSubdomains = setting.StrictTransportSecuritySubDomains
	}

	if setting.ContentSecurityPolicy != "" {
		secureOptions.ContentSecurityPolicy = setting.ContentSecurityPolicy
	}

	return secureOptions
}
