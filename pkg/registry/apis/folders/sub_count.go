package folders

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type subCountREST struct {
	service  folder.Service
	searcher resource.ResourceIndexClient
}

var (
	_ = rest.Connecter(&subCountREST{})
	_ = rest.StorageMetadata(&subCountREST{})
)

func (r *subCountREST) New() runtime.Object {
	return &v0alpha1.DescendantCounts{}
}

func (r *subCountREST) Destroy() {
}

func (r *subCountREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subCountREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subCountREST) ProducesObject(verb string) interface{} {
	return &v0alpha1.DescendantCounts{}
}

func (r *subCountREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subCountREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ns, err := request.NamespaceInfoFrom(ctx, true)
		if err != nil {
			responder.Error(err)
			return
		}

		rsp := &v0alpha1.DescendantCounts{}
		if r.searcher != nil {
			stats, err := r.searcher.GetStats(ctx, &resource.ResourceStatsRequest{
				Namespace: ns.Value,
				Folder:    name,
			})
			if err != nil {
				responder.Error(err)
			} else {
				rsp.Counts = make([]v0alpha1.ResourceStats, len(stats.Stats))
				for i, v := range stats.Stats {
					rsp.Counts[i] = v0alpha1.ResourceStats{
						Group:    v.Group,
						Resource: v.Resource,
						Count:    v.Count,
					}
				}
				responder.Object(200, rsp)
			}
			return
		}

		counts, err := r.service.GetDescendantCounts(ctx, &folder.GetDescendantCountsQuery{
			UID:          &name,
			OrgID:        ns.OrgID,
			SignedInUser: user,
		})
		if err != nil {
			responder.Error(err)
			return
		}
		for k, v := range counts {
			rsp.Counts = append(rsp.Counts, v0alpha1.ResourceStats{
				Group: k, // TODO convert legacy strings to group/resource
				Count: v,
			})
		}
		responder.Object(http.StatusOK, rsp)
	}), nil
}
