package scope

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	scope "github.com/grafana/grafana/pkg/apis/scope/v0alpha1"
)

type findREST struct {
	scopeNodeStorage *storage
}

var (
	_ rest.Storage              = (*findREST)(nil)
	_ rest.SingularNameProvider = (*findREST)(nil)
	_ rest.Connecter            = (*findREST)(nil)
	_ rest.Scoper               = (*findREST)(nil)
	_ rest.StorageMetadata      = (*findREST)(nil)
)

func (r *findREST) New() runtime.Object {
	// This is added as the "ResponseType" regarless what ProducesObject() says :)
	return &scope.FindResults{}
}

func (r *findREST) Destroy() {}

func (s *findREST) NamespaceScoped() bool {
	return true
}

func (s *findREST) GetSingularName() string {
	return "results" // not sure if this is actually used, but it is required to exist
}

func (r *findREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *findREST) ProducesObject(verb string) interface{} {
	return &scope.FindResults{}
}

func (r *findREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *findREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *findREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	// See: /pkg/apiserver/builder/helper.go#L34
	// The name is set with a rewriter hack
	if name != "name" {
		return nil, errors.NewNotFound(schema.GroupResource{}, name)
	}

	raw, err := r.scopeNodeStorage.List(ctx, &internalversion.ListOptions{})
	if err != nil {
		return nil, err
	}
	all, ok := raw.(*scope.ScopeNodeList)
	if !ok {
		return nil, fmt.Errorf("expected ScopeNodeList")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		results := &scope.FindResults{
			Message: "hello",
		}
		for _, item := range all.Items {
			// TODO... whatever filtering makes sense
			results.Found = append(results.Found, item.Name)
		}
		responder.Object(200, results)
	}), nil
}
