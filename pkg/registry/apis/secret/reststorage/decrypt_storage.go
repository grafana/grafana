package reststorage

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
	secretstore "github.com/grafana/grafana/pkg/storage/secret"
)

var (
	_ rest.Storage         = (*DecryptStorage)(nil)
	_ rest.Scoper          = (*DecryptStorage)(nil)
	_ rest.Connecter       = (*DecryptStorage)(nil)
	_ rest.StorageMetadata = (*DecryptStorage)(nil)
)

type DecryptStorage struct {
	config *setting.Cfg

	store secretstore.SecureValueStoreDecrypt
}

// NewDecryptStorage is a returns a constructed `*DecryptStorage`.
func NewDecryptStorage(config *setting.Cfg, store secretstore.SecureValueStoreDecrypt) *DecryptStorage {
	return &DecryptStorage{config, store}
}

// New returns an empty `*SecureValue` that is required to be implemented by any storage.
func (r *DecryptStorage) New() runtime.Object {
	return &secret.SecureValue{}
}

// Destroy is a no-op.
func (r *DecryptStorage) Destroy() {}

// NamespaceScoped returns `true` because the storage is namespaced (== org).
func (r *DecryptStorage) NamespaceScoped() bool {
	return true
}

// ConnectMethods returns the list of HTTP methods we accept for this subresource.
func (r *DecryptStorage) ConnectMethods() []string {
	return []string{http.MethodGet}
}

// NewConnectOptions returns some custom options that is passed in the `opts` field used by `Connect`.
func (r *DecryptStorage) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// ProducesMIMETypes returns the `Content-Type` used by `Connect`.
func (r *DecryptStorage) ProducesMIMETypes(verb string) []string {
	return []string{"text/plain"}
}

// ProducesObject returns the concrete type (marshable with `json` tags) used by `Connect`.
func (r *DecryptStorage) ProducesObject(verb string) interface{} {
	// TODO: this could be a string, if we use `responder.Object`.
	return &secret.SecureValue{}
}

// Connect returns an http.Handler that will handle the request/response for a given API invocation.
// See other methods implemented for supporting/optional functionality.
func (r *DecryptStorage) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns := request.NamespaceValue(ctx)

	val, err := r.store.Decrypt(ctx, ns, name)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// !!! DANGER !!!
		// This returns the decrypted and very raw `value` from a `securevalue`.
		// It should not be used in production mode!
		if r.config.Env != setting.Prod {
			_, _ = w.Write([]byte(val.Spec.Value))

			return
		}

		responder.Object(http.StatusOK, val)
	}), nil
}
