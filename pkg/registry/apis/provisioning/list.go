package provisioning

import (
	"context"
	"net/http"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// TODO: Rename to resources as it's not clear that we are returning here is repository resources
type listConnector struct {
	getter  RepoGetter
	lister  resources.ResourceLister
	timeout time.Duration
}

func NewListConnector(getter RepoGetter, lister resources.ResourceLister, customTimeout *time.Duration) *listConnector {
	timeout := 30 * time.Second
	if customTimeout != nil {
		timeout = *customTimeout
	}
	return &listConnector{getter: getter, lister: lister, timeout: timeout}
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

func (s *listConnector) Timeout() time.Duration { return s.timeout }

func (s *listConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ns, ok := request.NamespaceFrom(ctx)
		if !ok {
			responder.Error(k8serrors.NewBadRequest("missing namespace"))
			return
		}
		// TODO: Add pagination to resource lister
		rsp, err := s.lister.List(ctx, ns, name)
		if err != nil {
			responder.Error(err)
		} else {
			responder.Object(200, rsp)
		}
	}), nil
}

var (
	_ rest.Storage         = (*listConnector)(nil)
	_ rest.Connecter       = (*listConnector)(nil)
	_ rest.StorageMetadata = (*listConnector)(nil)
	_ TimeoutProvider      = (*listConnector)(nil)
)
