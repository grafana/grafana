package appsettings

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

type healthHandler struct {
	group           string
	client          backend.CheckHealthHandler
	contextProvider func(ctx context.Context) (context.Context, backend.PluginContext, error)
}

func (r *healthHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	ctx, pluginCtx, err := r.contextProvider(req.Context())
	if err != nil {
		_ = errhttp.Write(req.Context(), err, w)
		return
	}

	healthResponse, err := r.client.CheckHealth(ctx, &backend.CheckHealthRequest{
		PluginContext: pluginCtx,
	})
	if err != nil {
		_ = errhttp.Write(req.Context(), err, w)
		return
	}

	rsp := &apppluginV0.HealthCheckResult{}
	rsp.APIVersion = r.group + "/" + apppluginV0.VERSION
	rsp.Kind = "HealthCheckResult"
	rsp.Code = int(healthResponse.Status)
	rsp.Status = healthResponse.Status.String()
	rsp.Message = healthResponse.Message

	if len(healthResponse.JSONDetails) > 0 {
		err = json.Unmarshal(healthResponse.JSONDetails, &rsp.Details)
		if err != nil {
			_ = errhttp.Write(req.Context(), err, w)
			return
		}
	}

	statusCode := http.StatusOK
	if healthResponse.Status != backend.HealthStatusOk {
		statusCode = http.StatusBadRequest
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(rsp)
}
