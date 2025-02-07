package scope

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"

	scope "github.com/grafana/grafana/pkg/apis/scope/v0alpha1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
)

type findScopeDashboardsREST struct {
	scopeDashboardStorage *storage
}

var (
	_ rest.Storage              = (*findScopeDashboardsREST)(nil)
	_ rest.SingularNameProvider = (*findScopeDashboardsREST)(nil)
	_ rest.Connecter            = (*findScopeDashboardsREST)(nil)
	_ rest.Scoper               = (*findScopeDashboardsREST)(nil)
	_ rest.StorageMetadata      = (*findScopeDashboardsREST)(nil)
)

func (f *findScopeDashboardsREST) New() runtime.Object {
	return &scope.FindScopeDashboardBindingsResults{}
}

func (f *findScopeDashboardsREST) Destroy() {}

func (f *findScopeDashboardsREST) NamespaceScoped() bool {
	return true
}

func (f *findScopeDashboardsREST) GetSingularName() string {
	return "FindScopeDashboardsResult" // not sure if this is actually used, but it is required to exist
}

func (f *findScopeDashboardsREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (f *findScopeDashboardsREST) ProducesObject(verb string) interface{} {
	return &scope.FindScopeDashboardBindingsResults{}
}

func (f *findScopeDashboardsREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (f *findScopeDashboardsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (f *findScopeDashboardsREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	// See: /pkg/services/apiserver/builder/helper.go#L34
	// The name is set with a rewriter hack
	if name != "name" {
		return nil, errors.NewNotFound(schema.GroupResource{}, name)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		raw, err := f.scopeDashboardStorage.List(ctx, &internalversion.ListOptions{
			Limit: 10000,
		})
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
		results := &scope.FindScopeDashboardBindingsResults{
			Message: fmt.Sprintf("Find: %s", scopes),
			Items:   make([]scope.ScopeDashboardBinding, 0),
		}

		// we can improve the performance by calling .List once per scope if they are index by labels.
		// The API stays the same thou.
		for _, item := range all.Items {
			for _, s := range scopes {
				if item.Spec.Scope == s {
					results.Items = append(results.Items, item)
				}
			}
		}

		// sort the dashboard lists based on dashboard title.
		slices.SortFunc(results.Items, func(i, j scope.ScopeDashboardBinding) int {
			return strings.Compare(i.Status.DashboardTitle, j.Status.DashboardTitle)
		})

		logger.FromContext(req.Context()).Debug("find scopedashboardbinding", "raw", len(all.Items), "filtered", len(results.Items), "scopeQueryParams", strings.Join(scopes, ","))

		responder.Object(200, results)
	}), nil
}
