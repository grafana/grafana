package snapshot

import (
	"context"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

// Currently only works with v0alpha1
type dashboardREST struct {
	Service dashboardsnapshots.Service
}

func NewDashboardREST(
	resourceInfo utils.ResourceInfo,
	service dashboardsnapshots.Service,
) (rest.Storage, error) {
	return &dashboardREST{
		Service: service,
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
	_, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	snap, err := r.Service.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{Key: name})
	if err != nil {
		return nil, err
	}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// TODO... support conversions (not required in v0)
		dash := &dashv0.Dashboard{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: name,
			},
			Spec: v0alpha1.Unstructured{
				Object: snap.Dashboard.MustMap(),
			},
		}
		responder.Object(200, dash)
	}), nil
}
