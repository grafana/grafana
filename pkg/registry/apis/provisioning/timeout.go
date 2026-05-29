package provisioning

import (
	"context"
	"net/http"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

const defaultConnectTimeout = 30 * time.Second

// WithTimeoutFunc adds a timeout context to the request
func WithTimeoutFunc(f http.HandlerFunc, timeout time.Duration) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctxWithTimeout, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		f.ServeHTTP(w, r.WithContext(ctxWithTimeout))
	})
}

// TimeoutProvider lets a connector expose its desired Connect timeout so
// the storage-level wrapper can apply it uniformly without each Connect
// needing to call WithTimeout itself.
type TimeoutProvider interface {
	Timeout() time.Duration
}

// WithTimeout wraps any rest.Storage that implements rest.Connecter
// so the handler returned by Connect runs under a timeout context. Storage
// objects that aren't connecters are returned unchanged.
func WithTimeout(s rest.Storage) rest.Storage {
	c, ok := s.(rest.Connecter)
	if !ok {
		return s
	}

	timeout := defaultConnectTimeout
	if tp, ok := s.(TimeoutProvider); ok {
		timeout = tp.Timeout()
	}

	return &timeoutConnecter{storage: s, inner: c, timeout: timeout}
}

type timeoutConnecter struct {
	storage rest.Storage
	inner   rest.Connecter
	timeout time.Duration
}

// Functions that fulfil the rest.Storage and rest.Connector interface
func (t *timeoutConnecter) New() runtime.Object      { return t.storage.New() }
func (t *timeoutConnecter) Destroy()                 { t.storage.Destroy() }
func (t *timeoutConnecter) ConnectMethods() []string { return t.inner.ConnectMethods() }
func (t *timeoutConnecter) NewConnectOptions() (runtime.Object, bool, string) {
	return t.inner.NewConnectOptions()
}

// Connect passes a bound ctx to the HTTP handler.
func (t *timeoutConnecter) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
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
func (t *timeoutConnecter) ProducesMIMETypes(verb string) []string {
	if m, ok := t.inner.(rest.StorageMetadata); ok {
		return m.ProducesMIMETypes(verb)
	}
	return nil
}

func (t *timeoutConnecter) ProducesObject(verb string) any {
	if m, ok := t.inner.(rest.StorageMetadata); ok {
		return m.ProducesObject(verb)
	}
	return nil
}

var (
	_ rest.Storage         = (*timeoutConnecter)(nil)
	_ rest.Connecter       = (*timeoutConnecter)(nil)
	_ rest.StorageMetadata = (*timeoutConnecter)(nil)
)
