package dashboards

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	dashboards "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

type VersionsREST struct {
	Store   *genericregistry.Store
	builder *DashboardsAPIBuilder
}

var _ = rest.Connecter(&VersionsREST{})

func (r *VersionsREST) New() runtime.Object {
	return &dashboards.DashboardVersionsInfo{}
}

func (r *VersionsREST) Destroy() {
}

func (r *VersionsREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *VersionsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return &dashboards.VersionsQueryOptions{}, false, ""
}

func (r *VersionsREST) Connect(ctx context.Context, id string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	rsp, err := r.builder.dashboardVersionService.List(ctx, &dashver.ListDashboardVersionsQuery{
		DashboardUID: id,
		OrgID:        info.OrgID,
	})
	if err != nil {
		return nil, err
	}
	versions := &dashboards.DashboardVersionsInfo{}
	for _, v := range rsp {
		info := dashboards.DashboardVersionInfo{
			Version: v.Version,
			Created: v.Created.UnixMilli(),
			Message: v.Message,
		}
		if v.ParentVersion != v.Version {
			info.ParentVersion = v.ParentVersion
		}
		if v.CreatedBy > 0 {
			info.CreatedBy = fmt.Sprintf("%d", v.CreatedBy)
		}
		versions.Items = append(versions.Items, info)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Object(http.StatusOK, versions)
	}), nil
}
