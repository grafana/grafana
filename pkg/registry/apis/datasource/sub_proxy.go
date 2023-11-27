package datasource

import (
	"context"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type subProxyREST struct {
	builder *DSAPIBuilder
}

var _ = rest.Connecter(&subProxyREST{})

func (r *subProxyREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subProxyREST) Destroy() {
}

func (r *subProxyREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subProxyREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subProxyREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	pluginCtx, err := r.builder.getDataSourcePluginContext(ctx, name)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Error(fmt.Errorf("TODO, proxy: " + pluginCtx.PluginID))
	}), nil
}
