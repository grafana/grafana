package apiserver

import (
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// createDynamicHandlerWrapper wraps the not-found handler with dynamic custom resource handlers
func (s *service) createDynamicHandlerWrapper(builders []builder.APIGroupBuilder, notFoundHandler http.Handler) http.Handler {
	// Look for the APIExtensionsBuilder - we'll fetch the handler lazily on each request
	// because the handler is created during UpdateAPIGroupInfo which happens AFTER this wrapper is installed
	type dynamicHandlerProvider interface {
		GetDynamicHandler() http.Handler
	}

	var dhProvider dynamicHandlerProvider
	for _, b := range builders {
		if provider, ok := b.(dynamicHandlerProvider); ok {
			dhProvider = provider
			break
		}
	}

	if dhProvider == nil {
		return notFoundHandler
	}

	// Return a wrapper that lazily fetches and tries the dynamic handler on each request
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if this is an /apis/ request that might be for a custom resource
		if strings.HasPrefix(r.URL.Path, "/apis/") {
			// Fetch the dynamic handler (it will be nil until UpdateAPIGroupInfo creates it)
			dynamicHandler := dhProvider.GetDynamicHandler()
			if dynamicHandler != nil {
				// Create a response recorder to capture what the dynamic handler does
				recorder := &responseRecorder{
					ResponseWriter: w,
					statusCode:     0,
				}

				dynamicHandler.ServeHTTP(recorder, r)

				// If the dynamic handler handled it (didn't return 404), we're done
				if recorder.statusCode != 0 && recorder.statusCode != http.StatusNotFound {
					return
				}
			}
		}

		// Otherwise, fall back to the not-found handler
		notFoundHandler.ServeHTTP(w, r)
	})
}

// responseRecorder captures the status code from a handler
type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *responseRecorder) WriteHeader(statusCode int) {
	r.statusCode = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	if r.statusCode == 0 {
		r.statusCode = http.StatusOK
	}
	return r.ResponseWriter.Write(b)
}
