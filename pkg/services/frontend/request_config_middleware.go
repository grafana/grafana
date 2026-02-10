package frontend

import (
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/licensing"
	settingservice "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// RequestConfigMiddleware manages per-request configuration.
//
// When Settings Service is configured and namespace is present in baggage header:
// - Fetches tenant-specific overrides from Settings Service
// - Merges overrides with base configuration
// - Stores final configuration in context
//
// Otherwise, uses base configuration for all requests.
func RequestConfigMiddleware(cfg *setting.Cfg, license licensing.Licensing, settingsService settingservice.Service) web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, span := tracing.Start(r.Context(), "frontend.RequestConfigMiddleware")
			defer span.End()

			reqCtx := contexthandler.FromContext(ctx)
			logger := reqCtx.Logger

			// Create base request config from global settings
			// This is the default configuration that will be used for all requests
			requestConfig := NewFSRequestConfig(cfg, license)

			// Extract namespace from context (set by contextMiddleware)
			if namespace, ok := request.NamespaceFrom(ctx); ok {
				// Fetch tenant-specific configuration if namespace is present
				if settingsService != nil {
					// Fetch tenant overrides for relevant sections only
					selector := metav1.LabelSelector{
						MatchExpressions: []metav1.LabelSelectorRequirement{{
							Key:      "section",
							Operator: metav1.LabelSelectorOpIn,
							Values:   []string{"security"}, // TODO: get correct list
						}, {
							// don't return values from defaults.ini as they conflict with the services's own defaults
							Key:      "source",
							Operator: metav1.LabelSelectorOpNotIn,
							Values:   []string{"defaults"},
						}},
					}

					settings, err := settingsService.ListAsIni(ctx, selector)
					if err != nil {
						logger.Error("failed to fetch tenant settings", "namespace", namespace, "err", err)
						// Fall back to base config
					} else {
						// Merge tenant overrides with base config
						requestConfig.ApplyOverrides(settings, logger)
					}
				}
			}

			// Store config in context for other middleware/handlers to use
			ctx = requestConfig.WithContext(ctx)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
