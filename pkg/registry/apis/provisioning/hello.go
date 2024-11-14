package provisioning

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type helloWorldSubresource struct{}

func (*helloWorldSubresource) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &v0alpha1.HelloWorld{}
}

func (*helloWorldSubresource) Destroy() {}

func (*helloWorldSubresource) NamespaceScoped() bool {
	return true
}

func (*helloWorldSubresource) GetSingularName() string {
	return "HelloWorld"
}

func (*helloWorldSubresource) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*helloWorldSubresource) ProducesObject(verb string) any {
	return &v0alpha1.HelloWorld{}
}

func (*helloWorldSubresource) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (*helloWorldSubresource) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (*helloWorldSubresource) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		whom := r.URL.Query().Get("whom")
		if whom == "" {
			whom = "World"
		}

		responder.Object(http.StatusTeapot, &v0alpha1.HelloWorld{Whom: whom})
	}), nil
}

var (
	_ rest.Storage              = (*helloWorldSubresource)(nil)
	_ rest.Connecter            = (*helloWorldSubresource)(nil)
	_ rest.Scoper               = (*helloWorldSubresource)(nil)
	_ rest.SingularNameProvider = (*helloWorldSubresource)(nil)
	_ rest.StorageMetadata      = (*helloWorldSubresource)(nil)
)
