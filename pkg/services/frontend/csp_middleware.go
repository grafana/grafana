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

			logger.Debug("Applying CSP middleware", "enabled", requestConfig.CSPEnabled, "report_only_enabled", requestConfig.CSPReportOnlyEnabled)

			// Bail early if CSP is not enabled for this tenant
			if !requestConfig.CSPEnabled && !requestConfig.CSPReportOnlyEnabled {
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

			if requestConfig.CSPEnabled && requestConfig.CSPTemplate != "" {
				logger.Debug("Setting Content-Security-Policy header")
				policy := middleware.ReplacePolicyVariables(requestConfig.CSPTemplate, requestConfig.AppURL, nonce)
				w.Header().Set("Content-Security-Policy", policy)
			}

			if requestConfig.CSPReportOnlyEnabled && requestConfig.CSPReportOnlyTemplate != "" {
				logger.Debug("Setting Content-Security-Policy-Report-Only header")
				policy := middleware.ReplacePolicyVariables(requestConfig.CSPReportOnlyTemplate, requestConfig.AppURL, nonce)
				w.Header().Set("Content-Security-Policy-Report-Only", policy)
			}

			next.ServeHTTP(w, r)
		})
	}
}
