package cloudwatch

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

func (e *cloudWatchExecutor) newResourceMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/regions", handleResourceReq(e.handleGetRegions))
	mux.HandleFunc("/namespaces", handleResourceReq(e.handleGetNamespaces))
	mux.HandleFunc("/metrics", handleResourceReq(e.handleGetMetrics))
	mux.HandleFunc("/all-metrics", handleResourceReq(e.handleGetAllMetrics))
	mux.HandleFunc("/dimension-keys", handleResourceReq(e.handleGetDimensionKeys))
	mux.HandleFunc("/dimension-values", handleResourceReq(e.handleGetDimensionValues))
	mux.HandleFunc("/ebs-volume-ids", handleResourceReq(e.handleGetEbsVolumeIds))
	mux.HandleFunc("/ec2-instance-attribute", handleResourceReq(e.handleGetEc2InstanceAttribute))
	mux.HandleFunc("/resource-arns", handleResourceReq(e.handleGetResourceArns))
	return mux
}

type handleFn func(ctx context.Context, parameters url.Values,
	pluginCtx backend.PluginContext) ([]suggestData, error)

func handleResourceReq(handleMetricFind handleFn) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		ctx := req.Context()
		pluginContext := httpadapter.PluginConfigFromContext(ctx)
		err := req.ParseForm()
		if err != nil {
			writeResponse(rw, http.StatusBadRequest, fmt.Sprintf("unexpected error %v", err))
		}
		data, err := handleMetricFind(ctx, req.URL.Query(), pluginContext)
		if err != nil {
			writeResponse(rw, http.StatusBadRequest, fmt.Sprintf("unexpected error %v", err))
		}
		body, err := json.Marshal(data)
		if err != nil {
			writeResponse(rw, http.StatusBadRequest, fmt.Sprintf("unexpected error %v", err))
		}
		rw.WriteHeader(http.StatusOK)
		_, err = rw.Write(body)
		if err != nil {
			plog.Error("Unable to write HTTP response", "error", err)
		}
	}
}

func writeResponse(rw http.ResponseWriter, code int, msg string) {
	rw.WriteHeader(code)
	_, err := rw.Write([]byte(msg))
	if err != nil {
		plog.Error("Unable to write HTTP response", "error", err)
	}
}
