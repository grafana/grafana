package frontend

import (
	"net/http"

	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func CSPMiddleware(cfg *setting.Cfg) web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqCtx := contexthandler.FromContext(r.Context())
			logger := reqCtx.Logger

			logger.Debug("Applying CSP middleware", "enabled", cfg.CSPEnabled, "report_only_enabled", cfg.CSPReportOnlyEnabled)

			// Bail early if CSP is not enabled
			if !cfg.CSPEnabled && !cfg.CSPReportOnlyEnabled {
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

			if cfg.CSPEnabled && cfg.CSPTemplate != "" {
				logger.Debug("Setting Content-Security-Policy header")
				policy := middleware.ReplacePolicyVariables(cfg.CSPTemplate, cfg.AppURL, nonce)
				w.Header().Set("Content-Security-Policy", policy)
			}

			if cfg.CSPReportOnlyEnabled && cfg.CSPReportOnlyTemplate != "" {
				logger.Debug("Setting Content-Security-Policy-Report-Only header")
				policy := middleware.ReplacePolicyVariables(cfg.CSPReportOnlyTemplate, cfg.AppURL, nonce)
				w.Header().Set("Content-Security-Policy-Report-Only", policy)
			}

			next.ServeHTTP(w, r)
		})
	}
}
