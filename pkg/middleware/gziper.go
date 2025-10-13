package middleware

import (
	"bufio"
	"compress/gzip"
	"fmt"
	"net"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/web"
)

type gzipResponseWriter struct {
	w *gzip.Writer
	web.ResponseWriter
}

func (grw *gzipResponseWriter) WriteHeader(c int) {
	grw.Header().Del("Content-Length")
	grw.ResponseWriter.WriteHeader(c)
}

func (grw gzipResponseWriter) Write(p []byte) (int, error) {
	if grw.Header().Get("Content-Type") == "" {
		grw.Header().Set("Content-Type", http.DetectContentType(p))
	}
	grw.Header().Del("Content-Length")
	return grw.w.Write(p)
}

func (grw gzipResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hijacker, ok := grw.ResponseWriter.(http.Hijacker); ok {
		return hijacker.Hijack()
	}
	return nil, nil, fmt.Errorf("GZIP ResponseWriter doesn't implement the Hijacker interface")
}

type matcher func(s string) bool

func prefix(p string) matcher { return func(s string) bool { return strings.HasPrefix(s, p) } }
func substr(p string) matcher { return func(s string) bool { return strings.Contains(s, p) } }

var gzipIgnoredPaths = []matcher{
	prefix("/apis"), // apiserver handles its own compression https://github.com/kubernetes/kubernetes/blob/b60e01f881aa8a74b44d0ac1000e4f67f854273b/staging/src/k8s.io/apiserver/pkg/endpoints/handlers/responsewriters/writers.go#L155-L158
	prefix("/api/datasources"),
	prefix("/api/plugins"),
	prefix("/api/plugin-proxy/"),
	prefix("/api/gnet/"), // Already gzipped by grafana.com.
	prefix("/metrics"),
	prefix("/api/live/ws"),   // WebSocket does not support gzip compression.
	prefix("/api/live/push"), // WebSocket does not support gzip compression.
	substr("/resources"),
}

func Gziper() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			requestPath := req.URL.RequestURI()

			for _, pathMatcher := range gzipIgnoredPaths {
				if pathMatcher(requestPath) {
					next.ServeHTTP(rw, req)
					return
				}
			}

			if !strings.Contains(req.Header.Get("Accept-Encoding"), "gzip") {
				next.ServeHTTP(rw, req)
				return
			}

			grw := &gzipResponseWriter{gzip.NewWriter(rw), rw.(web.ResponseWriter)}
			grw.Header().Set("Content-Encoding", "gzip")
			grw.Header().Set("Vary", "Accept-Encoding")

			next.ServeHTTP(grw, req)
			// We can't really handle close errors at this point and we can't report them to the caller
			_ = grw.w.Close()
		})
	}
}
