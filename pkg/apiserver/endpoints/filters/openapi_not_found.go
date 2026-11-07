package filters

import (
	"net/http"
	"strings"

	"k8s.io/apiserver/pkg/endpoints/responsewriter"
)

const openAPIV3Prefix = "/openapi/v3/"

// WithOpenAPIV3NotFound answers 404 for an OpenAPI v3 document the server does
// not serve. For a group version it has no spec for, the upstream handler
// returns without writing a response, which Grafana's HTTP server reports as a
// 500 (web.missingWrite).
func WithOpenAPIV3NotFound(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if !strings.HasPrefix(req.URL.Path, openAPIV3Prefix) {
			handler.ServeHTTP(w, req)
			return
		}
		decorator := &writeTrackingWriter{ResponseWriter: w}
		handler.ServeHTTP(responsewriter.WrapForHTTP1Or2(decorator), req)
		if !decorator.written {
			http.NotFound(w, req)
		}
	})
}

type writeTrackingWriter struct {
	http.ResponseWriter
	written bool
}

var _ responsewriter.UserProvidedDecorator = (*writeTrackingWriter)(nil)

func (w *writeTrackingWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (w *writeTrackingWriter) WriteHeader(code int) {
	w.written = true
	w.ResponseWriter.WriteHeader(code)
}

func (w *writeTrackingWriter) Write(b []byte) (int, error) {
	w.written = true
	return w.ResponseWriter.Write(b)
}
