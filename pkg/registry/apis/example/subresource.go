package example

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

type DummySubresourceREST struct {
	Store *genericregistry.Store
}

var _ = rest.Connecter(&DummySubresourceREST{})

func (r *DummySubresourceREST) New() runtime.Object {
	return &example.DummySubresource{}
}

func (r *DummySubresourceREST) Destroy() {
}

func (r *DummySubresourceREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *DummySubresourceREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *DummySubresourceREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	// This response object format is negotiated by k8s
	dummy := &example.DummySubresource{
		Info: fmt.Sprintf("%s/%s", info.Value, user.Login),
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Object(http.StatusOK, dummy)
	}), nil
}
