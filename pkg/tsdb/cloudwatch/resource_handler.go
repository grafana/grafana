package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/routes"
)

func (e *cloudWatchExecutor) newResourceMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/ebs-volume-ids", handleResourceReq(e.handleGetEbsVolumeIds, e.logger))
	mux.HandleFunc("/ec2-instance-attribute", handleResourceReq(e.handleGetEc2InstanceAttribute, e.logger))
	mux.HandleFunc("/resource-arns", handleResourceReq(e.handleGetResourceArns, e.logger))
	mux.HandleFunc("/log-groups", routes.ResourceRequestMiddleware(routes.LogGroupsHandler, e.logger, e.getRequestContext))
	mux.HandleFunc("/metrics", routes.ResourceRequestMiddleware(routes.MetricsHandler, e.logger, e.getRequestContext))
	mux.HandleFunc("/dimension-values", routes.ResourceRequestMiddleware(routes.DimensionValuesHandler, e.logger, e.getRequestContext))
	mux.HandleFunc("/dimension-keys", routes.ResourceRequestMiddleware(routes.DimensionKeysHandler, e.logger, e.getRequestContext))
	mux.HandleFunc("/accounts", routes.ResourceRequestMiddleware(routes.AccountsHandler, e.logger, e.getRequestContext))
	mux.HandleFunc("/namespaces", routes.ResourceRequestMiddleware(routes.NamespacesHandler, e.logger, e.getRequestContext))
	mux.HandleFunc("/log-group-fields", routes.ResourceRequestMiddleware(routes.LogGroupFieldsHandler, e.logger, e.getRequestContext))
	mux.HandleFunc("/external-id", routes.ResourceRequestMiddleware(routes.ExternalIdHandler, e.logger, e.getRequestContextOnlySettings))
	mux.HandleFunc("/regions", routes.ResourceRequestMiddleware(routes.RegionsHandler, e.logger, e.getRequestContext))
	// remove this once AWS's Cross Account Observability is supported in GovCloud
	mux.HandleFunc("/legacy-log-groups", handleResourceReq(e.handleGetLogGroups, e.logger))

	return mux
}

type handleFn func(ctx context.Context, pluginCtx backend.PluginContext, parameters url.Values) ([]suggestData, error)

func handleResourceReq(handleFunc handleFn, logger log.Logger) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		ctx := req.Context()
		pluginContext := httpadapter.PluginConfigFromContext(ctx)
		err := req.ParseForm()
		if err != nil {
			writeResponse(rw, http.StatusBadRequest, fmt.Sprintf("unexpected error %v", err), logger.FromContext(ctx))
			return
		}
		data, err := handleFunc(ctx, pluginContext, req.URL.Query())
		if err != nil {
			writeResponse(rw, http.StatusBadRequest, fmt.Sprintf("unexpected error %v", err), logger.FromContext(ctx))
			return
		}
		body, err := json.Marshal(data)
		if err != nil {
			writeResponse(rw, http.StatusBadRequest, fmt.Sprintf("unexpected error %v", err), logger.FromContext(ctx))
			return
		}
		rw.WriteHeader(http.StatusOK)
		_, err = rw.Write(body)
		if err != nil {
			logger.FromContext(ctx).Error("Unable to write HTTP response", "error", err)
			return
		}
	}
}

func writeResponse(rw http.ResponseWriter, code int, msg string, logger log.Logger) {
	rw.WriteHeader(code)
	_, err := rw.Write([]byte(msg))
	if err != nil {
		logger.Error("Unable to write HTTP response", "error", err)
	}
}
