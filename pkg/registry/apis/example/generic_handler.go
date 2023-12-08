package example

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type genericHandler struct {
	namespaced bool
	newfunc    func() runtime.Object
}

var _ rest.Connecter = (*genericHandler)(nil)
var _ rest.Scoper = (*genericHandler)(nil)
var _ rest.SingularNameProvider = (*genericHandler)(nil)

func (r *genericHandler) New() runtime.Object {
	return r.newfunc()
}

func (r *genericHandler) Destroy() {}

func (r *genericHandler) GetSingularName() string {
	return "example"
}

func (r *genericHandler) NamespaceScoped() bool {
	return r.namespaced
}

func (r *genericHandler) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *genericHandler) NewConnectOptions() (runtime.Object, bool, string) {
	return r.newfunc(), false, ""
}

func (r *genericHandler) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.Write([]byte(fmt.Sprintf("Hello from generic handler for %s", name)))
	}), nil
}
