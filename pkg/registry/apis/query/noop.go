package query

import (
	"context"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

// Temporary noop storage that lets us map /connections/{name}/query
type noopREST struct{}

var (
	_ rest.Storage              = (*noopREST)(nil)
	_ rest.Connecter            = (*noopREST)(nil)
	_ rest.Scoper               = (*noopREST)(nil)
	_ rest.SingularNameProvider = (*noopREST)(nil)
)

// New implements [rest.Storage].
func (r *noopREST) New() runtime.Object {
	return &datasourceV0.QueryDataResponse{}
}

// ConnectMethods implements [rest.Storage].
func (r *noopREST) Destroy() {}

// NamespaceScoped implements [rest.Scoper].
func (r *noopREST) NamespaceScoped() bool {
	return false // will be removed from openapi spec, so doesn't matter
}

// GetSingularName implements [rest.SingularNameProvider].
func (r *noopREST) GetSingularName() string {
	return "noop"
}

// Connect implements [rest.Connecter].
func (*noopREST) Connect(ctx context.Context, id string, options runtime.Object, r rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		r.Object(200, &v1.Status{Message: "noop"})
	}), nil
}

// ConnectMethods implements [rest.Connecter].
func (r *noopREST) ConnectMethods() []string {
	return []string{"GET"}
}

// NewConnectOptions implements [rest.Connecter].
func (r *noopREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}
