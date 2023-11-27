package datasource

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/util/errutil/errhttp"
)

type subHealthREST struct {
	builder *DSAPIBuilder
}

var _ = rest.Connecter(&subHealthREST{})

func (r *subHealthREST) New() runtime.Object {
	return &metav1.Status{}
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
	pluginCtx, err := r.builder.getDataSourcePluginContext(ctx, name)
	if err != nil {
		return nil, err
	}
	healthResponse, err := r.builder.client.CheckHealth(ctx, &backend.CheckHealthRequest{
		PluginContext: *pluginCtx,
	})
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// TODO: respond with a k8s type
		jsonRsp, err := json.Marshal(healthResponse)
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}
		w.WriteHeader(200)
		_, _ = w.Write(jsonRsp)
	}), nil
}
