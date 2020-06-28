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

	if setting.ContentSecurityPolicy {
		cspConfig := ""
		if setting.ScriptSrc != "" {
			cspConfig += "script-src " + setting.ScriptSrc + ";"
		}
		if setting.ObjectSrc != "" {
			cspConfig += "object-src " + setting.ObjectSrc + ";"
		}
		if setting.FontSrc != "" {
			cspConfig += "font-src " + setting.FontSrc + ";"
		}
		if setting.StyleSrc != "" {
			cspConfig += "style-src " + setting.StyleSrc + ";"
		}
		if setting.ImgSrc != "" {
			cspConfig += "img-src " + setting.ImgSrc + ";"
		}
		if setting.BaseUri != "" {
			cspConfig += "base-uri " + setting.BaseUri + ";"
		}
		if setting.ConnectSrc != "" {
			cspConfig += "connect-src " + setting.ConnectSrc + ";"
		}
		if setting.ManifestSrc != "" {
			cspConfig += "manifest-src " + setting.ManifestSrc + ";"
		}
		if setting.MediaSrc != "" {
			cspConfig += "media-src " + setting.MediaSrc + ";"
		}
		if setting.BlockAllMixedContent {
			cspConfig += "block-all-mixed-content;"
		}

		secureOptions.ContentSecurityPolicy = cspConfig
	}

	return secureOptions
}
