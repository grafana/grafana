package example

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

type dummySubresourceREST struct{}

var _ = rest.Connecter(&dummySubresourceREST{})

func (r *dummySubresourceREST) New() runtime.Object {
	return &example.DummySubresource{}
}

func (r *dummySubresourceREST) Destroy() {
}

func (r *dummySubresourceREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *dummySubresourceREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *dummySubresourceREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
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
