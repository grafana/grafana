package plugin

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	aggregationv0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	"github.com/grafana/grafana/pkg/aggregator/apiserver/plugin/admission"
	"github.com/grafana/grafana/pkg/aggregator/apiserver/util"
	grafanasemconv "github.com/grafana/grafana/pkg/semconv"
	"k8s.io/component-base/tracing"
	"k8s.io/klog/v2"
)

func (h *PluginHandler) AdmissionMutationHandler(b aggregationv0alpha1.Backend) http.Handler {
	pluginID := b.PluginID
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		span := tracing.SpanFromContext(ctx)
		span.AddEvent("AdmissionMutationHandler")
		responder := &util.Responder{ResponseWriter: w}
		ar, err := admission.ParseRequest(h.admissionCodecs, r)
		if err != nil {
			responder.Error(w, r, err)
			return
		}

		span.AddEvent("GetPluginContext",
			grafanasemconv.GrafanaPluginId(pluginID),
		)
		pluginContext, err := h.pluginContextProvider.GetPluginContext(ctx, pluginID, "")
		if err != nil {
			responder.Error(w, r, fmt.Errorf("unable to get plugin context: %w", err))
			return
		}

		req, err := admission.ToAdmissionRequest(pluginContext, ar)
		if err != nil {
			responder.Error(w, r, fmt.Errorf("unable to convert admission request: %w", err))
			return
		}

		ctx = backend.WithGrafanaConfig(ctx, pluginContext.GrafanaConfig)
		span.AddEvent("MutateAdmission start")
		rsp, err := h.client.MutateAdmission(ctx, req)
		if err != nil {
			responder.Error(w, r, err)
			return
		}
		span.AddEvent("MutateAdmission end")

		span.AddEvent("FromMutationResponse start")
		res, err := admission.FromMutationResponse(ar.Request.Object.Raw, rsp)
		if err != nil {
			responder.Error(w, r, err)
			return
		}
		res.SetGroupVersionKind(ar.GroupVersionKind())
		res.Response.UID = ar.Request.UID

		respBytes, err := json.Marshal(res)
		if err != nil {
			klog.Error(err)
			responder.Error(w, r, err)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write(respBytes); err != nil {
			klog.Error(err)
		}
	})
}

func (h *PluginHandler) AdmissionValidationHandler(b aggregationv0alpha1.Backend) http.Handler {
	pluginID := b.PluginID
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		span := tracing.SpanFromContext(ctx)
		span.AddEvent("AdmissionValidationHandler")
		responder := &util.Responder{ResponseWriter: w}
		ar, err := admission.ParseRequest(h.admissionCodecs, r)
		if err != nil {
			responder.Error(w, r, err)
			return
		}

		span.AddEvent("GetPluginContext",
			grafanasemconv.GrafanaPluginId(pluginID),
		)
		pluginContext, err := h.pluginContextProvider.GetPluginContext(ctx, pluginID, "")
		if err != nil {
			responder.Error(w, r, fmt.Errorf("unable to get plugin context: %w", err))
			return
		}

		req, err := admission.ToAdmissionRequest(pluginContext, ar)
		if err != nil {
			responder.Error(w, r, fmt.Errorf("unable to convert admission request: %w", err))
			return
		}

		ctx = backend.WithGrafanaConfig(ctx, pluginContext.GrafanaConfig)
		span.AddEvent("ValidateAdmission start")
		rsp, err := h.client.ValidateAdmission(ctx, req)
		if err != nil {
			responder.Error(w, r, err)
			return
		}
		span.AddEvent("ValidateAdmission end")

		res := admission.FromValidationResponse(rsp)
		res.SetGroupVersionKind(ar.GroupVersionKind())
		res.Response.UID = ar.Request.UID

		respBytes, err := json.Marshal(res)
		if err != nil {
			klog.Error(err)
			responder.Error(w, r, err)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write(respBytes); err != nil {
			klog.Error(err)
		}
	})
}
