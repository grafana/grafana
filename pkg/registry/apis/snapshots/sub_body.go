package snapshots

import (
	"context"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/snapshots/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

type subBodyREST struct {
	service    dashboardsnapshots.Service
	namespacer request.NamespaceMapper
}

var _ = rest.Connecter(&subBodyREST{})

func (r *subBodyREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subBodyREST) Destroy() {
}

func (r *subBodyREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subBodyREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subBodyREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	snap, err := r.service.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{
		Key: name,
	})
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		r := convertSnapshotToK8sResource(snap, r.namespacer)
		responder.Object(200, &v0alpha1.FullDashboardSnapshot{
			ObjectMeta: r.ObjectMeta,
			Info:       r.Spec,
			Dashboard:  snap.Dashboard,
		})
	}), nil
}
