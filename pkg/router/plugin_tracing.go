package router

import (
	"net/http"

	v2 "github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute"
)

type tracedPluginHandler struct {
	*pluginroute.Handler
	pluginID string
	group    string
	live     v2.StreamClient
	// release frees what Load acquired for this handler; nil for none.
	release func()
}

func (h *tracedPluginHandler) PluginLiveClient() (string, v2.StreamClient) { return h.pluginID, h.live }

// Destroy releases the plugin's API server, then what Load acquired for it.
func (h *tracedPluginHandler) Destroy() {
	h.Handler.Destroy()
	if h.release != nil {
		h.release()
	}
}

func (h *tracedPluginHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	setPluginID(req, h.pluginID)
	span := trace.SpanFromContext(req.Context())
	if call := backendCallFrom(req.Context()); call != nil && call.span.Equal(span.SpanContext()) {
		// Routed plugin execution is already timed by the backend span.
		span.SetAttributes(attribute.String("grafana.plugin.id", h.pluginID))
		h.Handler.ServeHTTP(w, req)
		return
	}
	rec, req, _ := traceRouterRequest(w, req, "router.plugin", h.group, attribute.String("grafana.plugin.id", h.pluginID))
	defer rec.endSpan()
	h.Handler.ServeHTTP(rec.writer(), req)
}
