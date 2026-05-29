package provisioning

import (
	"context"
	"net/http"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

// WithTimeoutFunc adds a timeout context to the request
func WithTimeoutFunc(f http.HandlerFunc, timeout time.Duration) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctxWithTimeout, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		f.ServeHTTP(w, r.WithContext(ctxWithTimeout))
	})
}

// WithTimeout adds a timeout context to the request
func WithTimeout(s rest.Storage, timeout time.Duration) rest.Storage {
	c, ok := s.(rest.Connecter)
	if !ok {
		return s
	}

	return &timeoutConnector{storage: s, inner: c, timeout: timeout}
}

type timeoutConnector struct {
	storage rest.Storage
	inner   rest.Connecter
	timeout time.Duration
}

// Functions that fulfil the rest.Storage and rest.Connector interface
func (t *timeoutConnector) New() runtime.Object      { return t.storage.New() }
func (t *timeoutConnector) Destroy()                 { t.storage.Destroy() }
func (t *timeoutConnector) ConnectMethods() []string { return t.inner.ConnectMethods() }
func (t *timeoutConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return t.inner.NewConnectOptions()
}

// Connect passes a bound ctx to the HTTP handler.
func (t *timeoutConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	boundCtx, cancel := context.WithTimeout(ctx, t.timeout)
	handler, err := t.inner.Connect(boundCtx, name, opts, responder)
	if err != nil {
		cancel()
		return nil, err
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer cancel()
		handler.ServeHTTP(w, r.WithContext(boundCtx))
	}), nil
}

// Functions that implement the rest.StorageMetadata
func (t *timeoutConnector) ProducesMIMETypes(verb string) []string {
	if m, ok := t.inner.(rest.StorageMetadata); ok {
		return m.ProducesMIMETypes(verb)
	}
	return nil
}

func (t *timeoutConnector) ProducesObject(verb string) any {
	if m, ok := t.inner.(rest.StorageMetadata); ok {
		return m.ProducesObject(verb)
	}
	return nil
}

var (
	_ rest.Storage         = (*timeoutConnector)(nil)
	_ rest.Connecter       = (*timeoutConnector)(nil)
	_ rest.StorageMetadata = (*timeoutConnector)(nil)
)
