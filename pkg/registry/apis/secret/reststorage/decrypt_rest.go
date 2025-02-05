package reststorage

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

var (
	_ rest.Storage         = (*DecryptRest)(nil)
	_ rest.Scoper          = (*DecryptRest)(nil)
	_ rest.Connecter       = (*DecryptRest)(nil)
	_ rest.StorageMetadata = (*DecryptRest)(nil)
)

type DecryptRest struct {
	resource utils.ResourceInfo
	storage  contracts.DecryptStorage
}

// NewDecryptRest is a returns a constructed `*DecryptRest`.
func NewDecryptRest(resource utils.ResourceInfo, storage contracts.DecryptStorage) *DecryptRest {
	return &DecryptRest{resource, storage}
}

// New returns an empty `*SecureValue` that is required to be implemented by any storage.
func (s *DecryptRest) New() runtime.Object {
	return s.resource.NewFunc()
}

// Destroy is a no-op.
func (s *DecryptRest) Destroy() {}

// NamespaceScoped returns `true` because the storage is namespaced (== org).
func (s *DecryptRest) NamespaceScoped() bool {
	return true
}

// ConnectMethods returns the list of HTTP methods we accept for this subresource.
func (s *DecryptRest) ConnectMethods() []string {
	return []string{http.MethodGet}
}

// NewConnectOptions returns some custom options that is passed in the `opts` field used by `Connect`.
func (s *DecryptRest) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// ProducesMIMETypes returns the `Content-Type` used by `Connect`.
func (s *DecryptRest) ProducesMIMETypes(verb string) []string {
	return []string{"text/plain"}
}

// ProducesObject returns the concrete type (marshable with `json` tags) used by `Connect`.
func (s *DecryptRest) ProducesObject(verb string) interface{} {
	return s.resource.NewFunc()
}

// Connect returns an http.Handler that will handle the request/response for a given API invocation.
// See other methods implemented for supporting/optional functionality.
func (s *DecryptRest) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	nn := xkube.NameNamespace{
		Name:      name,
		Namespace: xkube.Namespace(request.NamespaceValue(ctx)),
	}

	exposedValue, err := s.storage.Decrypt(ctx, nn)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt secure value: %w", err)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// !!! DANGER !!!
		// This returns the decrypted and very raw `value` from a `securevalue`.
		// It should not be used in production mode!
		_, _ = w.Write([]byte(exposedValue.DangerouslyExposeAndConsumeValue()))
	}), nil
}
