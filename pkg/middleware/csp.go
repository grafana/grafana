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
// Also sets legacy X-Frame-Options header to deny if embedding is now allowed
func ContentSecurityPolicy(cfg *setting.Cfg, logger log.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		next = cspMiddleware(cfg, next, logger)

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

// Middleware handles both CSP and iFrame embedding headers.
func cspMiddleware(cfg *setting.Cfg, next http.Handler, logger log.Logger) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		ctx := contexthandler.FromContext(req.Context())
		if cfg.CSPEnabled {
			policy := ReplacePolicyVariables(cfg.CSPTemplate, cfg.AppURL, cfg.AllowEmbeddingHosts, ctx.RequestNonce)
			rw.Header().Set("Content-Security-Policy", policy)
		}

		if len(cfg.AllowEmbeddingHosts) == 1 && cfg.AllowEmbeddingHosts[0] == "*" {
			// Legacy allow, allow iframing
			logger.Debug("not setting x-frame-options: deny header")
		} else if len(cfg.AllowEmbeddingHosts) == 0 {
			// not configured, set x-frame-options: deny for backwards compat
			addXFrameOptionsDenyHeader(rw)
		} else if !cfg.CSPEnabled {
			// invalid scenario: specific hosts configured but CSP is disabled
			// deny all embedding to be safe
			addXFrameOptionsDenyHeader(rw)
			logger.Warn("allow_embedding_hosts is configured with specific hosts, setting x-frame-options: deny header to prevent embedding from unapproved hosts")
		}

		next.ServeHTTP(rw, req)
	})
}

func addXFrameOptionsDenyHeader(w http.ResponseWriter) {
	w.Header().Set("X-Frame-Options", "deny")
}

func cspReportOnlyMiddleware(cfg *setting.Cfg, next http.Handler, logger log.Logger) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		ctx := contexthandler.FromContext(req.Context())
		policy := ReplacePolicyVariables(cfg.CSPReportOnlyTemplate, cfg.AppURL, cfg.AllowEmbeddingHosts, ctx.RequestNonce)
		rw.Header().Set("Content-Security-Policy-Report-Only", policy)

		next.ServeHTTP(rw, req)
	})
}

func ReplacePolicyVariables(policyTemplate, appURL string, allowedHosts []string, nonce string) string {
	policy := strings.ReplaceAll(policyTemplate, "$NONCE", fmt.Sprintf("'nonce-%s'", nonce))
	re := regexp.MustCompile(`^\w+:(//)?`)
	rootPath := re.ReplaceAllString(appURL, "")
	policy = strings.ReplaceAll(policy, "$ROOT_PATH", rootPath)

	hostList := strings.Join(allowedHosts, " ")
	policy = strings.ReplaceAll(policy, "$ALLOW_EMBEDDING_HOSTS", hostList)

	return policy
}

func GenerateNonce() (string, error) {
	var buf [16]byte
	if _, err := io.ReadFull(rand.Reader, buf[:]); err != nil {
		return "", err
	}
	return base64.RawStdEncoding.EncodeToString(buf[:]), nil
}
