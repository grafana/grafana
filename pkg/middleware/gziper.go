package middleware

import (
	"bufio"
	"compress/gzip"
	"fmt"
	"net"
	"net/http"
	"strings"

	"gopkg.in/macaron.v1"
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
	fmt.Println("GZIP WRITE", grw.Header())
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

func Gziper() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestPath := r.URL.RequestURI()

			for _, pathPrefix := range gzipIgnoredPathPrefixes {
				if strings.HasPrefix(requestPath, pathPrefix) {
					next.ServeHTTP(w, r)
					return
				}
			}

			// ignore resources
			if (strings.HasPrefix(requestPath, "/api/datasources/") || strings.HasPrefix(requestPath, "/api/plugins/")) && strings.Contains(requestPath, resourcesPath) {
				next.ServeHTTP(w, r)
				return
			}

			if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
				next.ServeHTTP(w, r)
				return
			}

			grw := &gzipResponseWriter{gzip.NewWriter(w), w.(macaron.ResponseWriter)}
			grw.Header().Set("Content-Encoding", "gzip")
			grw.Header().Set("Vary", "Accept-Encoding")

			next.ServeHTTP(grw, r)
			// We can't really handle close errors at this point and we can't report them to the caller
			_ = grw.w.Close()
		})
	}
}
