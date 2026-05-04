package frontend

import (
	"net/http"

	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/web"
)

func CSPMiddleware() web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			reqCtx := contexthandler.FromContext(ctx)
			logger := reqCtx.Logger

			requestConfig, err := FSRequestConfigFromContext(ctx)
			if err != nil {
				logger.Error("unable to get request config", "err", err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			hasFullCSP := requestConfig.CSPEnabled || requestConfig.CSPReportOnlyEnabled

			logger.Debug("Applying CSP middleware",
				"enabled", requestConfig.CSPEnabled,
				"report_only_enabled", requestConfig.CSPReportOnlyEnabled,
				"allow_embedding_hosts", requestConfig.AllowEmbeddingHosts,
				"form_action_additional_hosts", requestConfig.FormActionAdditionalHosts,
			)

			// TODO: this per-tenant frontend service CSP middleware does NOT yet honor
			// `content_security_policy_minimal` (the minimal-CSP fallback). The classic
			// middleware in pkg/middleware/csp.go does. To keep behavior consistent, this
			// path should also apply middleware.MinimalCSPTemplate when CSPEnabled is false,
			// CSPMinimalEnabled is true, and CSPReportOnlyEnabled is false. 

			// Bail early if CSP is not enabled for this tenant
			if !hasFullCSP {
				next.ServeHTTP(w, r)
				return
			}

			nonce, err := middleware.GenerateNonce()
			if err != nil {
				logger.Error("Failed to generate CSP nonce", "err", err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}
			// Stored on the context so the index handler can put it in the HTML
			reqCtx.RequestNonce = nonce

			hosts := middleware.CSPHostLists{
				FrameAncestorHosts:        requestConfig.AllowEmbeddingHosts,
				FormActionAdditionalHosts: requestConfig.FormActionAdditionalHosts,
			}

			if requestConfig.CSPEnabled && requestConfig.CSPTemplate != "" {
				logger.Debug("Setting Content-Security-Policy header")
				policy := middleware.ReplacePolicyVariables(requestConfig.CSPTemplate, requestConfig.AppURL, hosts, nonce)
				w.Header().Set("Content-Security-Policy", policy)
			}

			if requestConfig.CSPReportOnlyEnabled && requestConfig.CSPReportOnlyTemplate != "" {
				logger.Debug("Setting Content-Security-Policy-Report-Only header")
				policy := middleware.ReplacePolicyVariables(requestConfig.CSPReportOnlyTemplate, requestConfig.AppURL, hosts, nonce)
				w.Header().Set("Content-Security-Policy-Report-Only", policy)
			}

			next.ServeHTTP(w, r)
		})
	}
}
