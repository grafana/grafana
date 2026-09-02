package router

import (
	"bytes"
	"net/http"
)

// openapiCacheEntry is one cached per-group-version OpenAPI v3 document.
// Valid only while rv matches the backend's current RV (checked by the
// caller); a stale rv is a cache miss, not an eviction — the sync.Map entry
// is simply overwritten on the next successful fetch.
type openapiCacheEntry struct {
	rv   string
	etag string
	body []byte
}

// stripConditionalHeaders removes conditional-GET headers from a request
// before proxying it upstream on a cache miss. Without this, a client's
// If-None-Match that didn't match our RV-based ETag (so we decided to proxy)
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
// group-version's serverRelativeURL with our own RV, an opaque cache token
// with no relation to the backend's content. But kube-openapi's own
// handler3 treats a client-supplied "hash" as a claim about ITS content
// hash and 301-redirects to the correct one on mismatch -- a redirect
// rejectBackendRedirects then turns into a 502. Since our RV essentially
// never matches the backend's real hash, forwarding it verbatim breaks
// every cold-cache request. Stripping it here keeps the RV-based
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
