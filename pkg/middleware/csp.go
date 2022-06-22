package middleware

import (
	// 	"crypto/rand" // LOGZ.IO GRAFANA CHANGE :: DEV-20823 New add security hedaers func
	// 	"encoding/base64" // LOGZ.IO GRAFANA CHANGE :: DEV-20823 New add security hedaers func
	// 	"fmt" // LOGZ.IO GRAFANA CHANGE :: DEV-20823 New add security hedaers func
	// 	"io" // LOGZ.IO GRAFANA CHANGE :: DEV-20823 New add security hedaers func
	"net/http"
	// 	"regexp" // LOGZ.IO GRAFANA CHANGE :: DEV-20823 New add security hedaers func
	// 	"strings" // LOGZ.IO GRAFANA CHANGE :: DEV-20823 New add security hedaers func

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/unrolled/secure" // LOGZ.IO GRAFANA CHANGE :: DEV-20823 Add package
)

// LOGZ.IO GRAFANA CHANGE :: DEV-20823 New add security hedaers func
// AddCSPHeader adds the Content Security Policy header.
func AddCSPHeader(cfg *setting.Cfg, logger log.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			secureMiddleware := secure.New(createSecureOptions(cfg))

			nonce, _ := secureMiddleware.ProcessAndReturnNonce(rw, req)
			ctx := contexthandler.FromContext(req.Context())

			ctx.RequestNonce = nonce
			logger.Debug("Successfully generated CSP nonce", "nonce", nonce)
			next.ServeHTTP(rw, req)
		})
	}
}

func createSecureOptions(cfg *setting.Cfg) secure.Options {
	secureOptions := secure.Options{
		ContentTypeNosniff: cfg.ContentTypeProtectionHeader,
		BrowserXssFilter:   cfg.XSSProtectionHeader,
		FrameDeny:          !cfg.AllowEmbedding,
		ForceSTSHeader:     (cfg.Protocol == setting.HTTPSScheme || cfg.Protocol == setting.HTTP2Scheme) && cfg.StrictTransportSecurity,
	}

	if secureOptions.ForceSTSHeader {
		secureOptions.STSSeconds = int64(cfg.StrictTransportSecurityMaxAge)
		secureOptions.STSPreload = cfg.StrictTransportSecurityPreload
		secureOptions.STSIncludeSubdomains = cfg.StrictTransportSecuritySubDomains
	}

	if cfg.CSPTemplate != "" {
		secureOptions.ContentSecurityPolicy = cfg.CSPTemplate
	}

	return secureOptions
}

// LOGZ.IO GRAFANA CHANGE :: DEV-20823 END
