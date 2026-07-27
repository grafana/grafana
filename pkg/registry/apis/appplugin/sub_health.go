package appplugin

import (
	"context"
	"encoding/json"
	"net/http"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
)

type subHealthREST struct {
	client          backend.CheckHealthHandler
	contextProvider func(ctx context.Context) (context.Context, backend.PluginContext, error)
}

var (
	_ = rest.Connecter(&subHealthREST{})
	_ = rest.StorageMetadata(&subHealthREST{})
)

func (r *subHealthREST) New() runtime.Object {
	return &apppluginV0.HealthCheckResult{}
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
	return &apppluginV0.HealthCheckResult{}
}

func (r *subHealthREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subHealthREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	if name != apppluginV0.INSTANCE_NAME {
		return nil, k8serrors.NewBadRequest("name can only be: " + apppluginV0.INSTANCE_NAME)
	}
	ns := request.NamespaceValue(ctx)
	if ns == "" {
		return nil, k8serrors.NewBadRequest("missing namespace in connect context")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ctx, pluginCtx, err := r.contextProvider(request.WithNamespace(req.Context(), ns))
		if err != nil {
			responder.Error(err)
			return
		}

		healthResponse, err := r.client.CheckHealth(ctx, &backend.CheckHealthRequest{
			PluginContext: pluginCtx,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		rsp := &apppluginV0.HealthCheckResult{}
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
