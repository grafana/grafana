package datasource

import (
	"context"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type subResourceREST struct {
	builder *DataSourceAPIBuilder
}

var _ rest.Connecter = (*subResourceREST)(nil)

func (r *subResourceREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subResourceREST) Destroy() {
}

func (r *subResourceREST) ConnectMethods() []string {
	// All for now??? ideally we have a schema for resource and limit this
	return []string{
		http.MethodGet,
		http.MethodHead,
		http.MethodPost,
		http.MethodPut,
		http.MethodPatch,
		http.MethodDelete,
		http.MethodOptions,
	}
}

func (r *subResourceREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

func (r *subResourceREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return r.builder.httpHandlers().resource(ctx, name, restHTTPResponder{responder})
}
