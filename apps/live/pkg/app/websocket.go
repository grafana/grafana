package app

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// WebsocketPath is the namespaced path of the Live websocket endpoint:
// /apis/live.grafana.app/v1alpha1/namespaces/{namespace}/ws
const WebsocketPath = "ws"

// WebsocketProvider serves the Live (Centrifuge) websocket protocol.
// The host supplies it: ST Grafana uses its local Live node, and a
// multi-tenant server can supply its own.
type WebsocketProvider interface {
	// ServeWS upgrades the request. The requester is on the request context and
	// has already been checked against namespace.
	ServeWS(w http.ResponseWriter, r *http.Request, namespace string)
}

// websocketNotServedHandler backs the manifest entry for WebsocketPath. The host
// serves the websocket before the API server sees the request, so reaching this
// handler means the request came through a path that cannot upgrade, such as a
// proxy or the Grafana router.
func websocketNotServedHandler(_ context.Context, w app.CustomRouteResponseWriter, _ *app.CustomRouteRequest) error {
	http.Error(w, "the live websocket must be opened with a websocket upgrade on a host that serves it directly", http.StatusUpgradeRequired)
	return nil
}

// NewWebsocketHandler returns the handler for WebsocketPath. It reads the
// namespace from the "namespace" path value and only lets a requester connect
// to its own namespace.
func NewWebsocketHandler(provider WebsocketProvider) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, err := identity.GetRequester(r.Context())
		if err != nil || user == nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		namespace := r.PathValue("namespace")
		if namespace == "" || namespace != user.GetNamespace() {
			http.Error(w, "namespace does not match the requester", http.StatusForbidden)
			return
		}
		provider.ServeWS(w, r, namespace)
	})
}
