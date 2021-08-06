package middleware

import (
	"bufio"
	"compress/gzip"
	"fmt"
	"net"
	"net/http"
	"strings"

	macaron "gopkg.in/macaron.v1"
)

const resourcesPath = "/resources"

var gzipIgnoredPathPrefixes = []string{
	"/api/datasources/proxy", // Ignore datasource proxy requests.
	"/api/plugin-proxy/",
	"/metrics",
	"/api/live/ws",   // WebSocket does not support gzip compression.
	"/api/live/push", // WebSocket does not support gzip compression.
}

type gzipResponseWriter struct {
	w *gzip.Writer
	macaron.ResponseWriter
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

func Gziper() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			requestPath := req.URL.RequestURI()

			for _, pathPrefix := range gzipIgnoredPathPrefixes {
				if strings.HasPrefix(requestPath, pathPrefix) {
					return
				}
			}

			// ignore resources
			if (strings.HasPrefix(requestPath, "/api/datasources/") || strings.HasPrefix(requestPath, "/api/plugins/")) && strings.Contains(requestPath, resourcesPath) {
				return
			}

			if !strings.Contains(req.Header.Get("Accept-Encoding"), "gzip") {
				next.ServeHTTP(rw, req)
				return
			}

			grw := &gzipResponseWriter{gzip.NewWriter(rw), rw.(macaron.ResponseWriter)}
			grw.Header().Set("Content-Encoding", "gzip")
			grw.Header().Set("Vary", "Accept-Encoding")

			next.ServeHTTP(grw, req)
			// We can't really handle close errors at this point and we can't report them to the caller
			_ = grw.w.Close()
		})
	}
}
