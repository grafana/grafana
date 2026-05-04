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

// minimalCSPTemplate is the hardcoded Content-Security-Policy used as a baseline when
// `content_security_policy = false` and `content_security_policy_minimal = true`. It is intentionally
// not configurable: it only sets the directives strictly required for Grafana's XSS protections
// (script-src, object-src, base-uri) so it can be combined with an existing CSP (e.g. from a
// reverse proxy) without unnecessarily restricting it. $NONCE is replaced per request.
const minimalCSPTemplate = "script-src 'self' 'unsafe-eval' 'unsafe-inline' 'strict-dynamic' $NONCE;object-src 'none';base-uri 'self'"

// ContentSecurityPolicy sets the configured Content-Security-Policy and/or Content-Security-Policy-Report-Only header(s) in the response.
//
// If CSP has been explicitly enabled via `content_security_policy = true`, the configured
// `content_security_policy_template` is used. Otherwise, when `content_security_policy_minimal`
// is enabled, a hardcoded minimal template (see minimalCSPTemplate) is applied as a baseline so
// we still get XSS protection out of the box without overwriting or duplicating any CSP that was
// set up explicitly by the operator. The minimal fallback is also suppressed when
// `content_security_policy_report_only` is enabled, since the operator is in monitor-only mode and
// an enforced minimal CSP would defeat that intent.
func ContentSecurityPolicy(cfg *setting.Cfg, logger log.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		switch {
		case cfg.CSPEnabled:
			next = cspMiddleware(cfg, next, logger)
		case cfg.CSPMinimalEnabled && !cfg.CSPReportOnlyEnabled:
			next = cspMinimalMiddleware(cfg, next, logger)
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
		hosts := CSPHostLists{FormActionAdditionalHosts: cfg.FormActionAdditionalHosts}
		policy := ReplacePolicyVariables(cfg.CSPTemplate, cfg.AppURL, hosts, ctx.RequestNonce)
		rw.Header().Set("Content-Security-Policy", policy)
		next.ServeHTTP(rw, req)
	})
}

func cspMinimalMiddleware(cfg *setting.Cfg, next http.Handler, logger log.Logger) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		ctx := contexthandler.FromContext(req.Context())
		hosts := CSPHostLists{FormActionAdditionalHosts: cfg.FormActionAdditionalHosts}
		policy := ReplacePolicyVariables(minimalCSPTemplate, cfg.AppURL, hosts, ctx.RequestNonce)
		rw.Header().Set("Content-Security-Policy", policy)
		next.ServeHTTP(rw, req)
	})
}

func cspReportOnlyMiddleware(cfg *setting.Cfg, next http.Handler, logger log.Logger) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		ctx := contexthandler.FromContext(req.Context())
		hosts := CSPHostLists{FormActionAdditionalHosts: cfg.FormActionAdditionalHosts}
		policy := ReplacePolicyVariables(cfg.CSPReportOnlyTemplate, cfg.AppURL, hosts, ctx.RequestNonce)
		rw.Header().Set("Content-Security-Policy-Report-Only", policy)
		next.ServeHTTP(rw, req)
	})
}

// CSPHostLists contains per-directive host lists for CSP template variable replacement.
type CSPHostLists struct {
	FrameAncestorHosts        []string
	FormActionAdditionalHosts []string
}

func ReplacePolicyVariables(policyTemplate, appURL string, hosts CSPHostLists, nonce string) string {
	policy := strings.ReplaceAll(policyTemplate, "$NONCE", fmt.Sprintf("'nonce-%s'", nonce))
	re := regexp.MustCompile(`^\w+:(//)?`)
	rootPath := re.ReplaceAllString(appURL, "")
	policy = strings.ReplaceAll(policy, "$ROOT_PATH", rootPath)

	// If the CSP directive has a $ALLOW_EMBEDDING_HOSTS variable, and the frameAncestorHosts is empty
	// then we deny all embedding by setting it to 'none'.
	var hostList string
	if len(hosts.FrameAncestorHosts) == 0 {
		hostList = "'none'"
	} else {
		hostList = strings.Join(hosts.FrameAncestorHosts, " ")
	}
	policy = strings.ReplaceAll(policy, "$ALLOW_EMBEDDING_HOSTS", hostList)

	// $FORM_ACTION_ADDITIONAL_HOSTS is replaced with the configured additional form-action hosts.
	// When empty, it resolves to an empty string — 'self' should be included directly in the template.
	policy = strings.ReplaceAll(policy, "$FORM_ACTION_ADDITIONAL_HOSTS", strings.Join(hosts.FormActionAdditionalHosts, " "))

	return policy
}

func GenerateNonce() (string, error) {
	var buf [16]byte
	if _, err := io.ReadFull(rand.Reader, buf[:]); err != nil {
		return "", err
	}
	return base64.RawStdEncoding.EncodeToString(buf[:]), nil
}
