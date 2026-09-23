package router

import (
	"net/http"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute"
)

type tracedPluginHandler struct {
	*pluginroute.Handler
	pluginID string
}

func (h *tracedPluginHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	rec, req, endSpan := traceRouterRequest(w, req, "router.plugin", attribute.String("grafana.plugin.id", h.pluginID))
	defer endSpan()
	h.Handler.ServeHTTP(rec, req)
}
