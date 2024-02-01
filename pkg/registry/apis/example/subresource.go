package example

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	example "github.com/grafana/grafana/pkg/apis/example/v0alpha1"
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
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("{\"status\": \"OK\"}"))
	}), nil
}
