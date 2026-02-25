package middleware

import (
	"bufio"
	"compress/flate"
	"compress/gzip"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/andybalholm/brotli"
	"github.com/klauspost/compress/zstd"

	"github.com/grafana/grafana/pkg/web"
)

type compressedResponseWriter struct {
	w io.WriteCloser
	web.ResponseWriter
}

func (crw *compressedResponseWriter) WriteHeader(c int) {
	crw.Header().Del("Content-Length")
	crw.ResponseWriter.WriteHeader(c)
}

func (crw compressedResponseWriter) Write(p []byte) (int, error) {
	if crw.Header().Get("Content-Type") == "" {
		crw.Header().Set("Content-Type", http.DetectContentType(p))
	}
	crw.Header().Del("Content-Length")
	return crw.w.Write(p)
}

func (crw compressedResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hijacker, ok := crw.ResponseWriter.(http.Hijacker); ok {
		return hijacker.Hijack()
	}
	return nil, nil, fmt.Errorf("compressed ResponseWriter doesn't implement the Hijacker interface")
}

type matcher func(s string) bool

func prefix(p string) matcher { return func(s string) bool { return strings.HasPrefix(s, p) } }
func substr(p string) matcher { return func(s string) bool { return strings.Contains(s, p) } }

var compressIgnoredPaths = []matcher{
	prefix("/apis"), // apiserver handles its own compression https://github.com/kubernetes/kubernetes/blob/b60e01f881aa8a74b44d0ac1000e4f67f854273b/staging/src/k8s.io/apiserver/pkg/endpoints/handlers/responsewriters/writers.go#L155-L158
	prefix("/api/datasources"),
	prefix("/api/plugins"),
	prefix("/api/plugin-proxy/"),
	prefix("/api/gnet/"), // Already compressed by grafana.com.
	prefix("/metrics"),
	prefix("/api/live/ws"),   // WebSocket does not support compression via this middleware.
	prefix("/api/live/push"), // WebSocket does not support compression via this middleware.
	substr("/resources"),
}

// supportedEncodings lists the compression encodings we support, in preference order.
// When multiple encodings have the same quality value, earlier entries win.
var supportedEncodings = []string{"zstd", "br", "gzip", "deflate"}

// negotiateEncoding parses the Accept-Encoding header and returns the best
// mutually-supported encoding. It returns "" if no supported encoding is acceptable.
func negotiateEncoding(acceptEncoding string) string {
	if acceptEncoding == "" {
		return ""
	}

	type encodingQuality struct {
		encoding string
		quality  float64
	}

	// Parse all encodings from the header.
	var candidates []encodingQuality
	for _, part := range strings.Split(acceptEncoding, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		encoding := part
		quality := 1.0

		if idx := strings.Index(part, ";"); idx != -1 {
			encoding = strings.TrimSpace(part[:idx])
			qPart := strings.TrimSpace(part[idx+1:])
			if strings.HasPrefix(qPart, "q=") {
				if q, err := strconv.ParseFloat(qPart[2:], 64); err == nil {
					quality = q
				}
			}
		}

		encoding = strings.ToLower(encoding)
		if quality > 0 {
			candidates = append(candidates, encodingQuality{encoding: encoding, quality: quality})
		}
	}

	// Pick the best supported encoding: highest quality, then our preference order.
	bestEncoding := ""
	bestQuality := 0.0
	bestPreference := len(supportedEncodings) // lower is better

	for _, c := range candidates {
		for i, supported := range supportedEncodings {
			if c.encoding == supported || c.encoding == "*" {
				if c.quality > bestQuality || (c.quality == bestQuality && i < bestPreference) {
					bestEncoding = supported
					bestQuality = c.quality
					bestPreference = i
				}
				break
			}
		}
	}

	return bestEncoding
}

// newCompressWriter creates a WriteCloser for the given encoding.
func newCompressWriter(rw io.Writer, encoding string) (io.WriteCloser, error) {
	switch encoding {
	case "zstd":
		return zstd.NewWriter(rw)
	case "br":
		return brotli.NewWriterOptions(rw, brotli.WriterOptions{Quality: 4}), nil
	case "gzip":
		return gzip.NewWriter(rw), nil
	case "deflate":
		return flate.NewWriter(rw, flate.DefaultCompression)
	default:
		return nil, fmt.Errorf("unsupported encoding: %s", encoding)
	}
}

// Compressor returns an HTTP middleware that compresses responses using the best
// encoding accepted by the client. Supported encodings: zstd, br (Brotli), gzip, deflate.
func Compressor() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			requestPath := req.URL.RequestURI()

			for _, pathMatcher := range compressIgnoredPaths {
				if pathMatcher(requestPath) {
					next.ServeHTTP(rw, req)
					return
				}
			}

			encoding := negotiateEncoding(req.Header.Get("Accept-Encoding"))
			if encoding == "" {
				next.ServeHTTP(rw, req)
				return
			}

			w, err := newCompressWriter(rw, encoding)
			if err != nil {
				next.ServeHTTP(rw, req)
				return
			}

			crw := &compressedResponseWriter{w, rw.(web.ResponseWriter)}
			crw.Header().Set("Content-Encoding", encoding)
			crw.Header().Set("Vary", "Accept-Encoding")

			next.ServeHTTP(crw, req)
			// We can't really handle close errors at this point and we can't report them to the caller
			_ = crw.w.Close()
		})
	}
}

// Gziper is deprecated: use Compressor instead. It is kept for backward compatibility.
func Gziper() func(http.Handler) http.Handler {
	return Compressor()
}
