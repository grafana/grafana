package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/setting"
)

// AddCSPHeader adds the Content Security Policy header.
func AddCSPHeader(cfg *setting.Cfg, logger log.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			if !cfg.CSPEnabled {
				next.ServeHTTP(rw, req)
				return
			}

			logger.Debug("Adding CSP header to response", "cfg", fmt.Sprintf("%p", cfg))

			ctx := contexthandler.FromContext(req.Context())
			if cfg.CSPTemplate == "" {
				logger.Debug("CSP template not configured, so returning 500")
				ctx.JsonApiErr(500, "CSP template has to be configured", nil)
				return
			}

			var buf [16]byte
			if _, err := io.ReadFull(rand.Reader, buf[:]); err != nil {
				logger.Error("Failed to generate CSP nonce", "err", err)
				ctx.JsonApiErr(500, "Failed to generate CSP nonce", err)
			}

			nonce := base64.RawStdEncoding.EncodeToString(buf[:])
			val := strings.ReplaceAll(cfg.CSPTemplate, "$NONCE", fmt.Sprintf("'nonce-%s'", nonce))

			re := regexp.MustCompile(`^\w+:(//)?`)
			rootPath := re.ReplaceAllString(cfg.AppURL, "")
			val = strings.ReplaceAll(val, "$ROOT_PATH", rootPath)
			rw.Header().Set("Content-Security-Policy", val)
			ctx.RequestNonce = nonce
			logger.Debug("Successfully generated CSP nonce", "nonce", nonce)
			next.ServeHTTP(rw, req)
		})
	}
}
