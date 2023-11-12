package dashboards

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	dashboards "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

type AccessREST struct {
	Store                   *genericregistry.Store
	dashboardVersionService dashver.Service
}

var _ = rest.Connecter(&AccessREST{})

func (r *AccessREST) New() runtime.Object {
	return &dashboards.DashboardAccessInfo{}
}

func (r *AccessREST) Destroy() {
}

func (r *AccessREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *AccessREST) NewConnectOptions() (runtime.Object, bool, string) {
	return &dashboards.VersionsQueryOptions{}, false, ""
}

func (r *AccessREST) Connect(ctx context.Context, id string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	_, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	access := &dashboards.DashboardAccessInfo{
		CanStar: true,
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Object(http.StatusOK, access)
	}), nil
}
