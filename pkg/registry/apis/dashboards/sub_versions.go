package dashboards

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/api/response"
	dashboards "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

type VersionsREST struct {
	Store                   *genericregistry.Store
	dashboardVersionService dashver.Service
}

var _ = rest.Connecter(&VersionsREST{})

var methods = []string{"GET"}

func (r *VersionsREST) New() runtime.Object {
	return &dashboards.VersionsQueryOptions{}
}

func (r *VersionsREST) Destroy() {
}

func (r *VersionsREST) ConnectMethods() []string {
	return methods
}

func (r *VersionsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return &dashboards.VersionsQueryOptions{}, false, ""
}

func (r *VersionsREST) Connect(ctx context.Context, id string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	queryOpts, ok := opts.(*dashboards.VersionsQueryOptions)
	if !ok {
		return nil, fmt.Errorf("invalid options object: %#v", opts)
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	rsp, err := r.dashboardVersionService.List(ctx, &dashver.ListDashboardVersionsQuery{
		DashboardUID: id,
		OrgID:        info.OrgID,
	})
	if err != nil {
		return nil, err
	}
	versions := dashboards.DashboardVersionsInfo{}
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

	fmt.Println("VersionsREST.Connect() called with id:", id, "and opts:", queryOpts)
	return &fakeHandler{opts: queryOpts, versions: versions}, nil
}

type fakeHandler struct {
	versions dashboards.DashboardVersionsInfo
	opts     *dashboards.VersionsQueryOptions
}

func (f *fakeHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	// rsp := map[string]any{
	// 	"url":      req.URL.Path,
	// 	"opts":     f.opts,
	// 	"versions": f.versions,
	// }
	w.WriteHeader(http.StatusOK)
	w.Write(response.JSON(http.StatusOK, f.versions).Body())
}
