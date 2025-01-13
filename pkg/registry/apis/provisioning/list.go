package provisioning

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type listConnector struct {
	getter RepoGetter
	lister resources.ObjectLister
}

func (*listConnector) New() runtime.Object {
	return &provisioning.ObjectList{}
}

func (*listConnector) Destroy() {}

func (*listConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*listConnector) ProducesObject(verb string) any {
	return &provisioning.ObjectList{}
}

func (*listConnector) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (*listConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (s *listConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing namespace")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Has("count") {
			rsp, err := s.lister.Stats(ctx, ns, name)
			if err != nil {
				responder.Error(err)
			} else {
				responder.Object(200, rsp)
			}
		} else {
			rsp, err := s.lister.List(ctx, ns, name)
			if err != nil {
				responder.Error(err)
			} else {
				responder.Object(200, rsp)
			}
		}
	}), nil
}

var (
	_ rest.Storage         = (*listConnector)(nil)
	_ rest.Connecter       = (*listConnector)(nil)
	_ rest.StorageMetadata = (*listConnector)(nil)
)
