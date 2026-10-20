package middleware

import (
	"bufio"
	"compress/gzip"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/web"
)

var gzipLogger = log.New("middleware.gzip")

type gzipResponseWriter struct {
	w *gzip.Writer
	web.ResponseWriter
}

func (grw *gzipResponseWriter) WriteHeader(c int) {
	grw.Header().Del("Content-Length")
	grw.ResponseWriter.WriteHeader(c)
}

func (grw *gzipResponseWriter) Write(p []byte) (int, error) {
	prepareCompressedHeaders(grw.Header(), p)

	return grw.w.Write(p)
}

func (grw *gzipResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return hijack(grw.ResponseWriter)
}

// headResponseWriter serves a HEAD request that would have been compressed. The
// response has no body, so there is nothing to compress, but the headers still
// have to describe the response the equivalent GET would return
// (RFC 9110 §9.3.2) - including the missing Content-Length, since the size of a
// compressed body is not known ahead of time.
type headResponseWriter struct {
	web.ResponseWriter
}

func (hrw *headResponseWriter) WriteHeader(c int) {
	hrw.Header().Del("Content-Length")
	hrw.ResponseWriter.WriteHeader(c)
}

func (hrw *headResponseWriter) Write(p []byte) (int, error) {
	prepareCompressedHeaders(hrw.Header(), p)
	return hrw.ResponseWriter.Write(p)
}

func (hrw *headResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return hijack(hrw.ResponseWriter)
}

func prepareCompressedHeaders(h http.Header, p []byte) {
	if h.Get("Content-Type") == "" {
		h.Set("Content-Type", http.DetectContentType(p))
	}
	// The length of the compressed body is unknown until it has been written.
	h.Del("Content-Length")
}

func hijack(rw web.ResponseWriter) (net.Conn, *bufio.ReadWriter, error) {
	if hijacker, ok := rw.(http.Hijacker); ok {
		return hijacker.Hijack()
	}
	return nil, nil, fmt.Errorf("GZIP ResponseWriter doesn't implement the Hijacker interface")
}

// gzipSink detects short writes without an error because compress/gzip only
// checks the underlying writer's error, not the number of bytes written.
type gzipSink struct {
	w io.Writer
}

func (s *gzipSink) Write(p []byte) (int, error) {
	n, err := s.w.Write(p)
	if err == nil && n != len(p) {
		err = io.ErrShortWrite
	}
	return n, err
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

			// A HEAD response has no body, so running one through a compressor is
			// pure overhead.
			if req.Method == http.MethodHead {
				hrw := &headResponseWriter{rw.(web.ResponseWriter)}
				hrw.Header().Set("Content-Encoding", "gzip")
				hrw.Header().Set("Vary", "Accept-Encoding")

				next.ServeHTTP(hrw, req)
				return
			}

			sink := &gzipSink{w: rw}
			grw := &gzipResponseWriter{gzip.NewWriter(sink), rw.(web.ResponseWriter)}
			grw.Header().Set("Content-Encoding", "gzip")
			grw.Header().Set("Vary", "Accept-Encoding")

			next.ServeHTTP(grw, req)

			// A failed response write cannot be reported to the caller at this
			// point, and this is the only signal it produces, so log it rather than
			// discard it.
			if err := grw.w.Close(); err != nil {
				logger := gzipLogger.FromContext(req.Context())
				if req.Context().Err() != nil {
					// The client hung up. Expected traffic, not a server problem.
					logger.Debug("Failed to write gzipped response", "path", req.URL.Path, "error", err)
				} else {
					logger.Warn("Failed to write gzipped response", "path", req.URL.Path, "error", err)
				}
			}
		})
	}
}
