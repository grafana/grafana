package dashboard

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type VersionsREST struct {
	search resource.ResourceSearchServer // should be a client!
}

var _ = rest.Connecter(&VersionsREST{})
var _ = rest.StorageMetadata(&VersionsREST{})

func (r *VersionsREST) New() runtime.Object {
	return &metav1.PartialObjectMetadataList{}
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
	return &metav1.PartialObjectMetadataList{}
}

func (r *VersionsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

func (r *VersionsREST) Connect(ctx context.Context, uid string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	key := &resource.ResourceKey{
		Namespace: info.Value,
		Group:     dashboard.GROUP,
		Resource:  dashboard.DashboardResourceInfo.GroupResource().Resource,
		Name:      uid,
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		path := req.URL.Path
		idx := strings.LastIndex(path, "/versions/")
		if idx > 0 {
			vkey := path[strings.LastIndex(path, "/")+1:]
			version, err := strconv.ParseInt(vkey, 10, 64)
			if err != nil {
				responder.Error(err)
				return
			}

			dashbytes, err := r.search.Read(ctx, &resource.ReadRequest{
				Key:             key,
				ResourceVersion: version,
			})
			if err != nil {
				responder.Error(err)
				return
			}

			// Convert the version to a regular dashboard
			dash := &dashboard.Dashboard{}
			json.Unmarshal(dashbytes.Value, dash)
			meta, err := utils.MetaAccessor(dash)
			if err != nil {
				responder.Error(err)
				return
			}
			meta.SetResourceVersionInt64(dashbytes.ResourceVersion)
			responder.Object(100, dash)
			return
		}

		rsp, err := r.search.History(ctx, &resource.HistoryRequest{
			NextPageToken: "", // TODO!
			Limit:         100,
			Key:           key,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		list := &metav1.PartialObjectMetadataList{
			ListMeta: metav1.ListMeta{
				Continue: rsp.NextPageToken,
			},
		}
		if rsp.ResourceVersion > 0 {
			list.ResourceVersion = strconv.FormatInt(rsp.ResourceVersion, 10)
		}

		for _, v := range rsp.Items {
			partial := metav1.PartialObjectMetadata{}
			err = json.Unmarshal(v.PartialObjectMeta, &partial)
			if err != nil {
				responder.Error(err)
				return
			}
			list.Items = append(list.Items, partial)
		}
		responder.Object(http.StatusOK, list)
	}), nil
}
