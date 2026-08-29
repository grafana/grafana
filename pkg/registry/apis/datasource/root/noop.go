package root

import (
	"context"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

// noopREST exists only because k8s requires a group to register at least one
// real storage. Connections are served as a custom route, so this path is
// removed from the OpenAPI spec in PostProcessOpenAPI.
type noopREST struct{}

var (
	_ rest.Storage              = (*noopREST)(nil)
	_ rest.Connecter            = (*noopREST)(nil)
	_ rest.Scoper               = (*noopREST)(nil)
	_ rest.SingularNameProvider = (*noopREST)(nil)
)

func (r *noopREST) New() runtime.Object {
	return &datasourceV0.DataSourceConnectionList{}
}

func (r *noopREST) Destroy() {}

func (r *noopREST) NamespaceScoped() bool {
	return false // removed from the openapi spec, so it doesn't matter
}

func (r *noopREST) GetSingularName() string {
	return "noop"
}

func (*noopREST) Connect(ctx context.Context, id string, options runtime.Object, r rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		r.Object(http.StatusOK, &metav1.Status{Message: "noop"})
	}), nil
}

func (r *noopREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *noopREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}
