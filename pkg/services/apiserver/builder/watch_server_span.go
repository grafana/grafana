package builder

import (
	"net/http"
	"strconv"

	k8stracing "k8s.io/component-base/tracing"
)

// withoutWatchServerSpan wraps the top-level "KubernetesAPI" server span so it is
// not created for watch requests. Watches are long-running connections whose span
// would stay open for the whole connection lifetime, which reflects how long the
// client stayed connected rather than request latency. Non-watch requests are
// traced unchanged.
//
// This suppresses only the Grafana-owned outer span. The upstream request span
// created inside DefaultBuildHandlerChain still exists and is instead tagged and
// renamed by filters.WithWatchInstrumentation so it can be filtered out downstream.
//
// Runs before DefaultBuildHandlerChain, so RequestInfo is not yet available; the
// watch is detected from the raw request instead.
func withoutWatchServerSpan(handler http.Handler, tp k8stracing.TracerProvider) http.Handler {
	traced := k8stracing.WithTracing(handler, tp, "KubernetesAPI")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isWatchRequest(r) {
			handler.ServeHTTP(w, r)
			return
		}
		traced.ServeHTTP(w, r)
	})
}

// isWatchRequest reports whether r is a watch, using the raw request since
// RequestInfo is not populated this early in the chain. A watch is a GET with a
// truthy watch query parameter (e.g. ?watch=true), matching how the apiserver
// decodes ListOptions.Watch.
func isWatchRequest(r *http.Request) bool {
	if r.Method != http.MethodGet {
		return false
	}
	v := r.URL.Query().Get("watch")
	if v == "" {
		return false
	}
	watch, err := strconv.ParseBool(v)
	return err == nil && watch
}
