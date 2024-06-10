package dashboardsnapshot

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	dashboardsnapshot "github.com/grafana/grafana/pkg/apis/dashboardsnapshot/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

type subBodyREST struct {
	service    dashboardsnapshots.Service
	namespacer request.NamespaceMapper
}

var _ = rest.Connecter(&subBodyREST{})

func (r *subBodyREST) New() runtime.Object {
	return &dashboardsnapshot.FullDashboardSnapshot{}
}

func (r *subBodyREST) Destroy() {}

func (r *subBodyREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subBodyREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subBodyREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		snap, err := r.service.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{
			Key: name,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		data, err := snap.Dashboard.Map()
		if err != nil {
			responder.Error(err)
			return
		}

		r := convertSnapshotToK8sResource(snap, r.namespacer)
		responder.Object(200, &dashboardsnapshot.FullDashboardSnapshot{
			ObjectMeta: r.ObjectMeta,
			Info:       r.Spec,
			Dashboard:  common.Unstructured{Object: data},
		})
	}), nil
}
