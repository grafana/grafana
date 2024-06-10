package dashboard

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
)

type VersionsREST struct {
	builder *DashboardsAPIBuilder
}

var _ = rest.Connecter(&VersionsREST{})
var _ = rest.StorageMetadata(&VersionsREST{})

func (r *VersionsREST) New() runtime.Object {
	return &dashboard.DashboardVersionList{}
}

func (r *VersionsREST) Destroy() {
}

func (r *VersionsREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *VersionsREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *VersionsREST) ProducesObject(verb string) interface{} {
	return &dashboard.DashboardVersionList{}
}

func (r *VersionsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

func (r *VersionsREST) Connect(ctx context.Context, uid string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		path := req.URL.Path
		idx := strings.LastIndex(path, "/versions/")
		if idx > 0 {
			key := path[strings.LastIndex(path, "/")+1:]
			version, err := strconv.Atoi(key)
			if err != nil {
				responder.Error(err)
				return
			}

			dto, err := r.builder.dashboardVersionService.Get(ctx, &dashver.GetDashboardVersionQuery{
				DashboardUID: uid,
				OrgID:        info.OrgID,
				Version:      version,
			})
			if err != nil {
				responder.Error(err)
				return
			}

			data, _ := dto.Data.Map()

			// Convert the version to a regular dashboard
			dash := &dashboard.Dashboard{
				ObjectMeta: metav1.ObjectMeta{
					Name:              uid,
					CreationTimestamp: metav1.NewTime(dto.Created),
				},
				Spec: common.Unstructured{Object: data},
			}
			responder.Object(100, dash)
			return
		}

		// Or list versions
		rsp, err := r.builder.dashboardVersionService.List(ctx, &dashver.ListDashboardVersionsQuery{
			DashboardUID: uid,
			OrgID:        info.OrgID,
		})
		if err != nil {
			responder.Error(err)
			return
		}
		versions := &dashboard.DashboardVersionList{}
		for _, v := range rsp {
			info := dashboard.DashboardVersionInfo{
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
		responder.Object(http.StatusOK, versions)
	}), nil
}
