package datasource

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

type subHealthREST struct {
	builder *DataSourceAPIBuilder
}

var _ = rest.Connecter(&subHealthREST{})

func (r *subHealthREST) New() runtime.Object {
	return &v0alpha1.HealthCheckResult{}
}

func (r *subHealthREST) Destroy() {
}

func (r *subHealthREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subHealthREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subHealthREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		pluginCtx, err := r.builder.getPluginContext(ctx, name)
		if err != nil {
			responder.Error(err)
			return
		}
		ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)

		healthResponse, err := r.builder.client.CheckHealth(ctx, &backend.CheckHealthRequest{
			PluginContext: pluginCtx,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		rsp := &v0alpha1.HealthCheckResult{}
		rsp.Code = int(healthResponse.Status)
		rsp.Status = healthResponse.Status.String()
		rsp.Message = healthResponse.Message

		if len(healthResponse.JSONDetails) > 0 {
			err = json.Unmarshal(healthResponse.JSONDetails, &rsp.Details)
			if err != nil {
				responder.Error(err)
				return
			}
		}

		statusCode := http.StatusOK
		if healthResponse.Status != backend.HealthStatusOk {
			statusCode = http.StatusBadRequest
		}
		responder.Object(statusCode, rsp)
	}), nil
}
