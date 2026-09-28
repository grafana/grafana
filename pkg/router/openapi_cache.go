package router

import (
	"bytes"
	"net/http"
	"strings"
)

// openapiCacheEntry is one cached per-group-version OpenAPI v3 document.
// The backend key and requested representation must match. Each group-version
// retains at most one representation, replaced on the next cacheable response.
type openapiCacheEntry struct {
	key      string
	etag     string
	body     []byte
	header   http.Header
	accept   string
	encoding string
}

func cacheableOpenAPIResponse(header http.Header) bool {
	for _, value := range header.Values("Cache-Control") {
		for directive := range strings.SplitSeq(value, ",") {
			name, _, _ := strings.Cut(strings.TrimSpace(directive), "=")
			switch strings.ToLower(name) {
			case "private", "no-store", "no-cache":
				return false
			}
		}
	}
	for _, value := range header.Values("Vary") {
		for field := range strings.SplitSeq(value, ",") {
			switch strings.ToLower(strings.TrimSpace(field)) {
			case "accept", "accept-encoding":
			default:
				return false
			}
		}
	}
	return len(header.Values("Set-Cookie")) == 0
}

func openAPICacheHeaders(header http.Header) http.Header {
	result := make(http.Header)
	// Keep representation metadata without replaying per-request headers such as Audit-Id.
	for _, name := range []string{"Content-Type", "Content-Encoding", "Vary", "Cache-Control", "Last-Modified"} {
		if values := header.Values(name); len(values) > 0 {
			result[name] = append([]string(nil), values...)
		}
	}
	return result
}

// stripConditionalHeaders removes conditional-GET headers before a cache-miss
// proxy. Otherwise the client's ETag could match the backend's unrelated one
// and produce a bodyless 304 with nothing to cache.
func stripConditionalHeaders(req *http.Request) {
	req.Header.Del("If-None-Match")
	req.Header.Del("If-Modified-Since")
}

// stripHashQueryParam removes our "hash" cache-busting parameter before
// proxying. kube-openapi treats "hash" as a claim about its own content and
// redirects on a mismatch, which rejectBackendRedirects turns into a 502.
func stripHashQueryParam(req *http.Request) {
	q := req.URL.Query()
	if !q.Has("hash") {
		return
	}
	q.Del("hash")
	req.URL.RawQuery = q.Encode()
}

// captureWriter records a proxied response (status + body) so it can be
// cached on success before being relayed to the real client, without letting
// the backend write directly to the real ResponseWriter first.
type captureWriter struct {
	header     http.Header
	statusCode int
	body       bytes.Buffer
}

func newCaptureWriter() *captureWriter {
	return &captureWriter{header: make(http.Header), statusCode: http.StatusOK}
}

func (c *captureWriter) Header() http.Header         { return c.header }
func (c *captureWriter) Write(p []byte) (int, error) { return c.body.Write(p) }
func (c *captureWriter) WriteHeader(code int)        { c.statusCode = code }

// Flush is a no-op: the body is buffered and copied out after ServeHTTP
// returns, but ReverseProxy still expects a Flusher.
func (c *captureWriter) Flush() {}
