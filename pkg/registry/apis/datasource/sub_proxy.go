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
	builder *DataSourceAPIBuilder
}

var _ = rest.Connecter(&subProxyREST{})

func (r *subProxyREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subProxyREST) Destroy() {}

func (r *subProxyREST) ConnectMethods() []string {
	unique := map[string]bool{}
	methods := []string{}
	for _, r := range r.builder.plugin.Routes {
		if unique[r.Method] {
			continue
		}
		unique[r.Method] = true
		methods = append(methods, r.Method)
	}
	return methods
}

func (r *subProxyREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
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
