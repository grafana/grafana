package plugin

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	grafanasemconv "github.com/grafana/grafana/pkg/semconv"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"k8s.io/component-base/tracing"
	"k8s.io/klog/v2"

	aggregationv0alpha1 "github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	"github.com/grafana/grafana/pkg/aggregator/apiserver/util"
)

func (h *PluginHandler) QueryDataHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		ctx := req.Context()
		span := tracing.SpanFromContext(ctx)
		span.AddEvent("QueryDataHandler")
		responder := &util.Responder{ResponseWriter: w}
		dqr := data.QueryDataRequest{}
		if err := json.NewDecoder(req.Body).Decode(&dqr); err != nil {
			responder.Error(w, req, err)
			return
		}

		dsUID := req.PathValue("uid")
		dsType := h.dataplaneService.Spec.PluginID

		queries, dsRef, err := data.ToDataSourceQueries(dqr)
		if err != nil {
			responder.Error(w, req, err)
			return
		}

		// this shouldn't happen, but just in case
		if dsRef == nil {
			responder.Error(w, req, fmt.Errorf("missing datasource reference"))
			return
		}

		// the datasource type in the query body should match the plugin ID
		if dsRef.Type != dsType {
			err := errors.New("invalid datasource type")
			klog.ErrorS(err, err.Error(), "dsType", dsType, "refType", dsRef.Type)
			responder.Error(w, req, err)
			return
		}

		// the UID in the query body should match the UID in the URL
		if dsRef.UID != dsUID {
			err := errors.New("invalid datasource UID")
			klog.ErrorS(err, err.Error(), "path", dsUID, "refUID", dsRef.UID)
			responder.Error(w, req, err)
			return
		}

		span.AddEvent("GetPluginContext",
			grafanasemconv.GrafanaDatasourceUid(dsRef.UID),
			grafanasemconv.GrafanaDatasourceType(dsRef.Type),
		)
		pluginContext, err := h.pluginContextProvider.GetPluginContext(ctx, dsRef.Type, dsRef.UID)
		if err != nil {
			responder.Error(w, req, fmt.Errorf("unable to get plugin context: %w", err))
			return
		}

		ctx = backend.WithGrafanaConfig(ctx, pluginContext.GrafanaConfig)
		span.AddEvent("QueryData start", grafanasemconv.GrafanaDatasourceRequestQueryCount(len(queries)))
		rsp, err := h.client.QueryData(ctx, &backend.QueryDataRequest{
			Queries:       queries,
			PluginContext: pluginContext,
		})
		if err != nil {
			responder.Error(w, req, err)
			return
		}
		statusCode := 200
		span.AddEvent("QueryData end", semconv.HTTPResponseStatusCode(statusCode))
		responder.Object(statusCode,
			&aggregationv0alpha1.QueryDataResponse{QueryDataResponse: *rsp},
		)
	}
}
