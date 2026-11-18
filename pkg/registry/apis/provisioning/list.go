package provisioning

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// TODO: Rename to resources as it's not clear that we are returning here is repository resources
type listConnector struct {
	getter RepoGetter
	lister resources.ResourceLister
}

func NewListConnector(getter RepoGetter, lister resources.ResourceLister) *listConnector {
	return &listConnector{getter: getter, lister: lister}
}

func (*listConnector) New() runtime.Object {
	return &provisioning.ResourceList{}
}

func (*listConnector) Destroy() {}

func (*listConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*listConnector) ProducesObject(verb string) any {
	return &provisioning.ResourceList{}
}

func (*listConnector) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (*listConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (s *listConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		listOpts, err := listOptionsFromQuery(r.URL.Query())
		if err != nil {
			responder.Error(err)
			return
		}

		ns := request.NamespaceValue(ctx)
		rsp, err := s.lister.List(ctx, ns, name, listOpts)
		if err := resource.StatusErrorFromGRPC(err); err != nil {
			responder.Error(err)
		} else {
			responder.Object(200, rsp)
		}
	}), nil
}

// listOptionsFromQuery reads the paging parameters. Neither is required: without them the whole
// list is returned, as it was before paging existed.
func listOptionsFromQuery(query url.Values) (resources.ListOptions, error) {
	opts := resources.ListOptions{Continue: query.Get("continue")}
	if raw := query.Get("limit"); raw != "" {
		limit, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || limit < 0 {
			return opts, apierrors.NewBadRequest(fmt.Sprintf("invalid limit %q: expected a non-negative integer", raw))
		}
		opts.Limit = limit
	}
	return opts, nil
}

var (
	_ rest.Storage         = (*listConnector)(nil)
	_ rest.Connecter       = (*listConnector)(nil)
	_ rest.StorageMetadata = (*listConnector)(nil)
)
