package reststorage

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ rest.Storage         = (*DecryptStorage)(nil)
	_ rest.Scoper          = (*DecryptStorage)(nil)
	_ rest.Connecter       = (*DecryptStorage)(nil)
	_ rest.StorageMetadata = (*DecryptStorage)(nil)
)

type DecryptStorage struct {
	config   *setting.Cfg
	resource utils.ResourceInfo
	storage  contracts.SecureValueStorage
}

// NewDecryptStorage is a returns a constructed `*DecryptStorage`.
func NewDecryptStorage(config *setting.Cfg, resource utils.ResourceInfo, storage contracts.SecureValueStorage) *DecryptStorage {
	return &DecryptStorage{config, resource, storage}
}

// New returns an empty `*SecureValue` that is required to be implemented by any storage.
func (s *DecryptStorage) New() runtime.Object {
	return s.resource.NewFunc()
}

// Destroy is a no-op.
func (s *DecryptStorage) Destroy() {}

// NamespaceScoped returns `true` because the storage is namespaced (== org).
func (s *DecryptStorage) NamespaceScoped() bool {
	return true
}

// ConnectMethods returns the list of HTTP methods we accept for this subresource.
func (s *DecryptStorage) ConnectMethods() []string {
	return []string{http.MethodGet}
}

// NewConnectOptions returns some custom options that is passed in the `opts` field used by `Connect`.
func (s *DecryptStorage) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// ProducesMIMETypes returns the `Content-Type` used by `Connect`.
func (s *DecryptStorage) ProducesMIMETypes(verb string) []string {
	return []string{"text/plain"}
}

// ProducesObject returns the concrete type (marshable with `json` tags) used by `Connect`.
func (s *DecryptStorage) ProducesObject(verb string) interface{} {
	return s.resource.NewFunc()
}

// Connect returns an http.Handler that will handle the request/response for a given API invocation.
// See other methods implemented for supporting/optional functionality.
func (s *DecryptStorage) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	nn := xkube.NameNamespace{
		Name:      name,
		Namespace: xkube.Namespace(request.NamespaceValue(ctx)),
	}

	sv, err := s.storage.Read(ctx, nn)
	if err != nil {
		if errors.Is(err, contracts.ErrSecureValueNotFound) {
			return nil, s.resource.NewNotFound(name)
		}

		return nil, fmt.Errorf("failed to read secure value: %w", err)
	}

	// TODO: obtain exposed value with decrypt
	exposedValue := secretv0alpha1.ExposedSecureValue("dummy value")

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// !!! DANGER !!!
		// This returns the decrypted and very raw `value` from a `securevalue`.
		// It should not be used in production mode!
		if s.config.Env != setting.Prod {
			_, _ = w.Write([]byte(exposedValue.DangerouslyExposeAndConsumeValue()))

			return
		}

		responder.Object(http.StatusOK, sv)
	}), nil
}
