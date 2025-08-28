package datasource

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

type noopREST struct{}

var (
	_ rest.Storage              = (*noopREST)(nil)
	_ rest.Scoper               = (*noopREST)(nil)
	_ rest.Getter               = (*noopREST)(nil)
	_ rest.SingularNameProvider = (*noopREST)(nil)
)

func (r *noopREST) New() runtime.Object {
	// This is added as the "ResponseType" regarless what ProducesObject() says :)
	return &query.QueryDataResponse{}
}

func (r *noopREST) Destroy() {}

// NamespaceScoped implements rest.Scoper.
func (r *noopREST) NamespaceScoped() bool {
	return true
}

func (r *noopREST) GetSingularName() string {
	return "noop"
}

func (r *noopREST) Get(ctx context.Context, name string, options *v1.GetOptions) (runtime.Object, error) {
	return &metav1.Status{
		Status:  metav1.StatusSuccess,
		Message: "noop",
	}, nil
}
