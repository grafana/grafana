package snapshot

import (
	"context"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

// Currently only works with v0alpha1
type dashboardREST struct {
	getter rest.Getter
}

func NewDashboardREST(
	getter rest.Getter,
) (rest.Storage, error) {
	return &dashboardREST{
		getter: getter,
	}, nil
}

var (
	_ rest.Connecter       = (*dashboardREST)(nil)
	_ rest.StorageMetadata = (*dashboardREST)(nil)
)

func (r *dashboardREST) New() runtime.Object {
	return &dashv0.Dashboard{}
}

func (r *dashboardREST) Destroy() {
}

func (r *dashboardREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *dashboardREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *dashboardREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *dashboardREST) ProducesObject(verb string) interface{} {
	return r.New()
}

func (r *dashboardREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	// Get the snapshot from unified storage
	obj, err := r.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return nil, fmt.Errorf("expected Snapshot, got %T", obj)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// TODO... support conversions (not required in v0)
		dash := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: ns.Value,
			},
			Spec: v0alpha1.Unstructured{
				Object: snap.Spec.Dashboard,
			},
		}
		responder.Object(200, dash)
	}), nil
}
