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

type findScopedDashboardsREST struct {
	scopeDashboardStorage *storage
}

var (
	_ rest.Storage              = (*findScopedDashboardsREST)(nil)
	_ rest.SingularNameProvider = (*findScopedDashboardsREST)(nil)
	_ rest.Connecter            = (*findScopedDashboardsREST)(nil)
	_ rest.Scoper               = (*findScopedDashboardsREST)(nil)
	_ rest.StorageMetadata      = (*findScopedDashboardsREST)(nil)
)

func (r *findScopedDashboardsREST) New() runtime.Object {
	return &scope.FindScopedDashboardsResults{}
}

func (r *findScopedDashboardsREST) Destroy() {}

func (s *findScopedDashboardsREST) NamespaceScoped() bool {
	return true
}

func (s *findScopedDashboardsREST) GetSingularName() string {
	return "results" // not sure if this is actually used, but it is required to exist
}

func (r *findScopedDashboardsREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *findScopedDashboardsREST) ProducesObject(verb string) interface{} {
	return &scope.FindScopedDashboardsResults{}
}

func (r *findScopedDashboardsREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *findScopedDashboardsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *findScopedDashboardsREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	// See: /pkg/apiserver/builder/helper.go#L34
	// The name is set with a rewriter hack
	if name != "name" {
		return nil, errors.NewNotFound(schema.GroupResource{}, name)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		raw, err := r.scopeDashboardStorage.List(ctx, &internalversion.ListOptions{})
		if err != nil {
			w.WriteHeader(500)
			return
		}
		all, ok := raw.(*scope.ScopeDashboardBindingList)
		if !ok {
			w.WriteHeader(500)
			return
		}

		scopes := req.URL.Query()["scope"]
		results := &scope.FindScopedDashboardsResults{
			Message: fmt.Sprintf("Find: %s", scopes),
			Found:   make([]scope.ScopeDashboardBinding, 0),
		}

		// we can improve the performance by calling .List once per scope if they are index by labels.
		// The API stays the same thou.
		for _, item := range all.Items {
			for _, s := range scopes {
				if item.Spec.Scope == s {
					results.Found = append(results.Found, item)
				}
			}
		}

		responder.Object(200, results)
	}), nil
}
