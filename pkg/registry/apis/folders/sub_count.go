package folders

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
)

type subCountREST struct {
	service folder.Service
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
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ns, err := request.NamespaceInfoFrom(ctx, true)
		if err != nil {
			responder.Error(err)
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

		responder.Object(http.StatusOK, &v0alpha1.DescendantCounts{
			Counts: counts,
		})
	}), nil
}
