package provisioning

import (
	"context"
	"net/http"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
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

	return &timeoutConnector{Storage: s, Connecter: c, timeout: timeout}
}

type timeoutConnector struct {
	rest.Storage
	rest.Connecter
	timeout time.Duration
}

// Connect attaches a bound ctx to the existing request context
func (t *timeoutConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The k8s library does not copy over the namespace to the request context so we need to manually copy it over
		// https://github.com/kubernetes/apiserver/blob/release-1.36/pkg/endpoints/handlers/rest.go#L189-L190
		ns := request.NamespaceValue(ctx)
		reqCtx := request.WithNamespace(r.Context(), ns)

		boundCtx, cancel := context.WithTimeout(reqCtx, t.timeout)
		defer cancel()
		handler, err := t.Connecter.Connect(boundCtx, name, opts, responder)
		if err != nil {
			responder.Error(err)
			return
		}
		handler.ServeHTTP(w, r.WithContext(boundCtx))
	}), nil
}

// Functions that implement the rest.StorageMetadata
func (t *timeoutConnector) ProducesMIMETypes(verb string) []string {
	if m, ok := t.Connecter.(rest.StorageMetadata); ok {
		return m.ProducesMIMETypes(verb)
	}
	return nil
}

func (t *timeoutConnector) ProducesObject(verb string) any {
	if m, ok := t.Connecter.(rest.StorageMetadata); ok {
		return m.ProducesObject(verb)
	}
	return nil
}

var (
	_ rest.Storage         = (*timeoutConnector)(nil)
	_ rest.Connecter       = (*timeoutConnector)(nil)
	_ rest.StorageMetadata = (*timeoutConnector)(nil)
)
