package provisioning

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// statsConnector counts what one repository manages, at request time rather than from a
// stored field.
type statsConnector struct {
	lister resources.ResourceLister
}

func NewStatsConnector(lister resources.ResourceLister) *statsConnector {
	return &statsConnector{lister: lister}
}

func (*statsConnector) New() runtime.Object {
	return &provisioning.ResourceCountList{}
}

func (*statsConnector) Destroy() {}

func (*statsConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*statsConnector) ProducesObject(verb string) any {
	return &provisioning.ResourceCountList{}
}

func (*statsConnector) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (*statsConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (s *statsConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ns := request.NamespaceValue(ctx)
		counts, err := s.lister.RepositoryStats(ctx, ns, name)
		if err := resource.StatusErrorFromGRPC(err); err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, &provisioning.ResourceCountList{Items: counts})
	}), nil
}

var (
	_ rest.Storage         = (*statsConnector)(nil)
	_ rest.Connecter       = (*statsConnector)(nil)
	_ rest.StorageMetadata = (*statsConnector)(nil)
)
