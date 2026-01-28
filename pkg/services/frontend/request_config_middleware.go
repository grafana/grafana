package frontend

import (
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	settingservice "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/web"
)

// RequestConfigMiddleware manages per-request configuration.
//
// When Settings Service is configured and Grafana-Namespace header is present:
// - Fetches tenant-specific overrides from Settings Service
// - Merges overrides with base configuration
// - Stores final configuration in context
//
// Otherwise, uses base configuration for all requests.
func RequestConfigMiddleware(baseConfig FSRequestConfig, settingsService settingservice.Service) web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, span := tracing.Start(r.Context(), "frontend.RequestConfigMiddleware")
			defer span.End()

			namespace := r.Header.Get("Grafana-Namespace")
			ctx = request.WithNamespace(ctx, namespace)

			reqCtx := contexthandler.FromContext(ctx)
			logger := reqCtx.Logger

			finalConfig := baseConfig

			// Fetch tenant-specific configuration if namespace is present
			if namespace != "" && settingsService != nil {
				// Fetch tenant overrides for relevant sections only
				selector := metav1.LabelSelector{
					MatchExpressions: []metav1.LabelSelectorRequirement{{
						Key:      "section",
						Operator: metav1.LabelSelectorOpIn,
						Values:   []string{"security"}, // TODO: get correct list
					}},
				}

				settings, err := settingsService.ListAsIni(ctx, selector)
				if err != nil {
					logger.Error("failed to fetch tenant settings", "namespace", namespace, "err", err)
					// Fall back to base config
				} else {
					// Merge tenant overrides with base config
					finalConfig = baseConfig.WithOverrides(settings, logger)
				}
			}

			// Store config in context
			ctx = finalConfig.WithContext(ctx)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
