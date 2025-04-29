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

// ContentSecurityPolicy sets the configured Content-Security-Policy and/or Content-Security-Policy-Report-Only header(s) in the response.
func ContentSecurityPolicy(cfg *setting.Cfg, logger log.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if cfg.CSPEnabled {
			next = cspMiddleware(cfg, next, logger)
		}
		if cfg.CSPReportOnlyEnabled {
			next = cspReportOnlyMiddleware(cfg, next, logger)
		}
		next = nonceMiddleware(next, logger)
		return next
	}
}

func nonceMiddleware(next http.Handler, logger log.Logger) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		ctx := contexthandler.FromContext(req.Context())
		nonce, err := GenerateNonce()
		if err != nil {
			logger.Error("Failed to generate CSP nonce", "err", err)
			ctx.JsonApiErr(500, "Failed to generate CSP nonce", err)
		}
		ctx.RequestNonce = nonce
		logger.Debug("Successfully generated CSP nonce", "nonce", nonce)
		next.ServeHTTP(rw, req)
	})
}

func cspMiddleware(cfg *setting.Cfg, next http.Handler, logger log.Logger) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		ctx := contexthandler.FromContext(req.Context())
		policy := ReplacePolicyVariables(cfg.CSPTemplate, cfg.AppURL, ctx.RequestNonce)
		rw.Header().Set("Content-Security-Policy", policy)
		next.ServeHTTP(rw, req)
	})
}

func cspReportOnlyMiddleware(cfg *setting.Cfg, next http.Handler, logger log.Logger) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		ctx := contexthandler.FromContext(req.Context())
		policy := ReplacePolicyVariables(cfg.CSPReportOnlyTemplate, cfg.AppURL, ctx.RequestNonce)
		rw.Header().Set("Content-Security-Policy-Report-Only", policy)
		next.ServeHTTP(rw, req)
	})
}

func ReplacePolicyVariables(policyTemplate, appURL, nonce string) string {
	policy := strings.ReplaceAll(policyTemplate, "$NONCE", fmt.Sprintf("'nonce-%s'", nonce))
	re := regexp.MustCompile(`^\w+:(//)?`)
	rootPath := re.ReplaceAllString(appURL, "")
	policy = strings.ReplaceAll(policy, "$ROOT_PATH", rootPath)
	return policy
}

func GenerateNonce() (string, error) {
	var buf [16]byte
	if _, err := io.ReadFull(rand.Reader, buf[:]); err != nil {
		return "", err
	}
	return base64.RawStdEncoding.EncodeToString(buf[:]), nil
}
