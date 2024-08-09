package collection

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	collection "github.com/grafana/grafana/pkg/apis/collection/v0alpha1"
)

type subAddREST struct {
	// TODO???
}

var (
	_ = rest.Connecter(&subAddREST{})
	_ = rest.StorageMetadata(&subAddREST{})
)

func (r *subAddREST) New() runtime.Object {
	return &collection.Collection{}
}

func (r *subAddREST) Destroy() {
}

func (r *subAddREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *subAddREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subAddREST) ProducesObject(verb string) interface{} {
	return &collection.Collection{}
}

func (r *subAddREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subAddREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	// user, err := identity.GetRequester(ctx)
	// if err != nil {
	// 	return nil, err
	// }

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// ns, err := request.NamespaceInfoFrom(ctx, true)
		// if err != nil {
		// 	responder.Error(err)
		// 	return
		// }

		v := req.URL.Query()
		for _, add := range v["add"] {
			fmt.Printf("ADD: %s\n", add)
		}
		for _, remove := range v["remove"] {
			fmt.Printf("ADD: %s\n", remove)
		}

		responder.Object(http.StatusOK, &collection.Collection{})
	}), nil
}
