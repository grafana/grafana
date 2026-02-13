package plugin

import (
	"encoding/json"
	"fmt"
	"net/http"

	"k8s.io/component-base/tracing"
	"k8s.io/klog/v2"

	grafanasemconv "github.com/grafana/grafana/pkg/semconv"
)

func (h *PluginHandler) SettingsHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		ctx := req.Context()
		span := tracing.SpanFromContext(ctx)
		span.AddEvent("SettingsHandler")

		pluginID := h.dataplaneService.Spec.PluginID

		namespace := req.PathValue("namespace")
		if namespace == "" {
			writeError(w, http.StatusBadRequest, "namespace not found in request path")
			return
		}

		span.AddEvent("GetPluginSettings",
			grafanasemconv.GrafanaPluginId(pluginID),
		)
		settings, err := h.pluginSettingsProvider.GetPluginSettings(ctx, pluginID, namespace)
		if err != nil {
			span.RecordError(err)
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("unable to get plugin settings: %v", err))
			return
		}

		span.AddEvent("GetPluginSettings end")

		respBytes, err := json.Marshal(settings)
		if err != nil {
			klog.Error(err)
			writeError(w, http.StatusInternalServerError, "failed to marshal plugin settings")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write(respBytes); err != nil {
			klog.Error(err)
		}
	}
}

func writeError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	resp, _ := json.Marshal(map[string]string{"error": message})
	if _, err := w.Write(resp); err != nil {
		klog.Error(err)
	}
}
