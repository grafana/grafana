package datasource

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	datasource "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type subHealthREST struct {
	builder *DataSourceAPIBuilder
}

var (
	_ = rest.Connecter(&subHealthREST{})
	_ = rest.StorageMetadata(&subHealthREST{})
)

func (r *subHealthREST) New() runtime.Object {
	return &datasource.HealthCheckResult{}
}

func (r *subHealthREST) Destroy() {
}

func (r *subHealthREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subHealthREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subHealthREST) ProducesObject(verb string) interface{} {
	return &datasource.HealthCheckResult{}
}

func (r *subHealthREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// FIXME: this endpoint has not been tested yet, so it is not enabled by default.
var healthEnabled = false

func (r *subHealthREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	if !healthEnabled {
		return nil, &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status: metav1.StatusFailure,
				Code:   http.StatusNotImplemented,
			},
		}
	}

	pluginCtx, err := r.builder.getPluginContext(ctx, name)
	if err != nil {
		return nil, err
	}
	ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
	ctx = contextualMiddlewares(ctx)

	healthResponse, err := r.builder.client.CheckHealth(ctx, &backend.CheckHealthRequest{
		PluginContext: pluginCtx,
	})
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		rsp := &datasource.HealthCheckResult{}
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
