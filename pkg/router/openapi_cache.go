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

// stripConditionalHeaders removes conditional-GET headers from a request
// before proxying it upstream on a cache miss. Without this, a client's
// If-None-Match that didn't match our key-based ETag (so we decided to proxy)
// could still coincidentally match the backend's own unrelated ETag scheme,
// producing a bodyless 304 we'd have no way to distinguish from "unchanged"
// — a phantom empty response with nothing to cache or serve. Stripping
// guarantees the backend always gives us a real, judgeable status code.
func stripConditionalHeaders(req *http.Request) {
	req.Header.Del("If-None-Match")
	req.Header.Del("If-Modified-Since")
}

// stripHashQueryParam removes the "hash" query parameter before proxying a
// request upstream. Our discovery doc (buildOpenAPIV3Index) hash-busts each
// group-version's serverRelativeURL with our own key, an opaque cache token
// with no relation to the backend's content. But kube-openapi's own
// handler3 treats a client-supplied "hash" as a claim about ITS content
// hash and 301-redirects to the correct one on mismatch -- a redirect
// rejectBackendRedirects then turns into a 502. Since our key essentially
// never matches the backend's real hash, forwarding it verbatim breaks
// every cold-cache request. Stripping it here keeps the key-based
// busting meaningful for our own cache/ETag while never surfacing our
// token to a protocol that expects its own.
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

// Flush is a no-op: captureWriter owns its own in-memory buffer (there is no
// underlying real ResponseWriter to unwrap to yet -- the buffered body is
// copied to the real ResponseWriter only after ServeHTTP returns), but it
// must still satisfy http.Flusher so ReverseProxy's flush machinery (used
// for chunked/SSE/any response with no Content-Length) doesn't treat this
// writer as unsupported.
func (c *captureWriter) Flush() {}
