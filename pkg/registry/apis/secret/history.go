package secret

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	secretstore "github.com/grafana/grafana/pkg/storage/secret"
)

// TODO: what really do we need to implement in this case?
var (
	_ rest.Storage         = (*secretHistory)(nil)
	_ rest.Scoper          = (*secretHistory)(nil)
	_ rest.Connecter       = (*secretHistory)(nil)
	_ rest.StorageMetadata = (*secretHistory)(nil)
)

// secretHistory implements the methods for the "history" subresource. This is exposed via HTTP, not gRPC.
type secretHistory struct {
	// TODO: we can use composition and only expose the `History` method this uses.
	store secretstore.SecureValueStore
}

// New returns an empty `*SecureValueActivityList` that is required to be implemented by any storage.
func (r *secretHistory) New() runtime.Object {
	return &secret.SecureValueActivityList{}
}

// Destroy is a no-op.
func (r *secretHistory) Destroy() {}

// NamespaceScoped returns `true` because the storage is namespaced (== org).
func (r *secretHistory) NamespaceScoped() bool {
	return true
}

// ConnectMethods returns the list of HTTP methods we accept for this subresource.
func (r *secretHistory) ConnectMethods() []string {
	return []string{http.MethodGet}
}

// NewConnectOptions returns some custom options that is passed in the `opts` field used by `Connect`.
func (r *secretHistory) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// ProducesMIMETypes returns the `Content-Type` used by `Connect`.
func (r *secretHistory) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

// ProducesObject returns the concrete type (marshable with `json` tags) used by `Connect`.
func (r *secretHistory) ProducesObject(verb string) interface{} {
	return &secret.SecureValueActivityList{}
}

// Connect returns an http.Handler that will handle the request/response for a given API invocation.
// See other methods implemented for supporting/optional functionality.
func (r *secretHistory) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns := request.NamespaceValue(ctx)

	// TODO: should this be inside the HTTP handler?
	val, err := r.store.History(ctx, ns, name, "")
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Object(http.StatusOK, val)
	}), nil
}
