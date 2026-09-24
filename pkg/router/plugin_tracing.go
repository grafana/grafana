package router

import (
	"net/http"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute"
)

type tracedPluginHandler struct {
	*pluginroute.Handler
	pluginID string
	group    string
}

func (h *tracedPluginHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	span := trace.SpanFromContext(req.Context())
	if parent, ok := req.Context().Value(routerSpanKey{}).(trace.SpanContext); ok && parent.Equal(span.SpanContext()) {
		// Routed plugin execution is already timed by the backend span.
		span.SetAttributes(attribute.String("grafana.plugin.id", h.pluginID))
		h.Handler.ServeHTTP(w, req)
		return
	}
	rec, req, endSpan := traceRouterRequest(w, req, "router.plugin", h.group, attribute.String("grafana.plugin.id", h.pluginID))
	defer endSpan()
	h.Handler.ServeHTTP(rec, req)
}
