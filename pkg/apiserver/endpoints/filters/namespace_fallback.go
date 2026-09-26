package filters

import (
	"net/http"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/features"
)

// WithTransactionContextFallback fills in a namespace for OpenFeature flag
// evaluation when nothing upstream (e.g. features.WithTransactionContextMiddleware
// reading the HG gateway's baggage header) already set one. A caller that
// reaches this apiserver directly - service-to-service, never proxied
// through the gateway that injects baggage - carries no baggage header, so
// without this fallback its flag evaluations silently target the "default"
// namespace instead of its real one.
//
// Must run after WithRequester (for identity.GetRequester) and after
// DefaultBuildHandlerChain has run (for request.RequestInfoFrom, set by its
// WithRequestInfo filter from the URL path).
func WithTransactionContextFallback(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ctx := req.Context()

		var ns string
		if info, ok := request.RequestInfoFrom(ctx); ok {
			ns = info.Namespace
		}
		if ns == "" || ns == "*" {
			ns = ""
			if requester, err := identity.GetRequester(ctx); err == nil && requester != nil {
				if requesterNs := requester.GetNamespace(); requesterNs != "*" {
					ns = requesterNs
				}
			}
		}

		req = req.WithContext(features.WithTransactionContextFallback(ctx, ns))
		handler.ServeHTTP(w, req)
	})
}
