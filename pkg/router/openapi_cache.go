package router

import (
	"bytes"
	"maps"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

// Bounds on what captureWriter buffers. The documents are served whole from
// memory, so a backend must not be able to grow one without limit. Variables
// so that tests can lower them.
var (
	maxCachedOpenAPIDocBytes = 32 << 20
	maxDiscoveryDocBytes     = 16 << 20
)

// captureWriter records a proxied response (status + body) so it can be
// cached on success before being relayed to the real client, without letting
// the backend write directly to the real ResponseWriter first.
//
// A body larger than limit is not buffered. With a passthrough writer, the
// response streams to it from then on; without one, the rest is discarded.
// Either way overflowed is set. Writes never fail, since ReverseProxy aborts
// the handler with a panic on a failed write.
type captureWriter struct {
	header     http.Header
	statusCode int
	body       bytes.Buffer

	limit       int
	passthrough http.ResponseWriter
	overflowed  bool
}

func newCaptureWriter(limit int, passthrough http.ResponseWriter) *captureWriter {
	return &captureWriter{header: make(http.Header), statusCode: http.StatusOK, limit: limit, passthrough: passthrough}
}

func (c *captureWriter) Header() http.Header  { return c.header }
func (c *captureWriter) WriteHeader(code int) { c.statusCode = code }

func (c *captureWriter) Write(p []byte) (int, error) {
	if !c.overflowed && c.body.Len()+len(p) <= c.limit {
		return c.body.Write(p)
	}
	if !c.overflowed {
		c.overflowed = true
		if c.passthrough != nil {
			maps.Copy(c.passthrough.Header(), c.header)
			c.passthrough.WriteHeader(c.statusCode)
			_, _ = c.passthrough.Write(c.body.Bytes()) // nolint:gosec // G705: the backend's response, relayed unchanged
		}
		c.body = bytes.Buffer{}
	}
	if c.passthrough != nil {
		_, _ = c.passthrough.Write(p)
	}
	return len(p), nil
}

// Flush flushes a response that streams to passthrough. Otherwise it is a
// no-op: the body is buffered and copied out after ServeHTTP returns, but
// ReverseProxy still expects a Flusher.
func (c *captureWriter) Flush() {
	if f, ok := c.passthrough.(http.Flusher); ok && c.overflowed {
		f.Flush()
	}
}

// handleOpenAPIv3 serves the OpenAPI v3 discovery index and per-group-version
// documents.
func (r *GrafanaRouter) handleOpenAPIv3(w http.ResponseWriter, req *http.Request) {
	if !utils.IsCanonicalAPIPath(req.URL) {
		setRoute(req, routeInvalid)
		http.Error(w, "non-canonical API path", http.StatusBadRequest)
		return
	}
	if req = r.authenticate(w, req); req == nil {
		return
	}
	r.serveOpenAPIV3(w, req)
}

// serveOpenAPIV3 serves the /openapi/v3 index and per-group-version documents.
func (r *GrafanaRouter) serveOpenAPIV3(w http.ResponseWriter, req *http.Request) {
	if req.URL.Path == openapiV3Prefix || req.URL.Path == openapiV3Prefix+"/" {
		setRoute(req, routeDiscovery)
		r.serveOpenAPIIndex(w, req)
		return
	}
	group, version, ok := parseOpenAPIGroupVersionPath(req.URL.Path)
	if !ok {
		serveNotFound(w, req)
		return
	}
	if group == discoveryGroup {
		serveDiscoveryOpenAPI(w, req, version)
		return
	}
	r.serveOpenAPIGroupVersion(w, req, group, version)
}

// serveOpenAPIGroupVersion proxies one group-version's OpenAPI v3 document
// from its owning backend, cached and validated against the backend key.
func (r *GrafanaRouter) serveOpenAPIGroupVersion(w http.ResponseWriter, req *http.Request, group, version string) {
	handlers := *r.snapshot.Load()
	entry, ok := handlers[group]
	if !ok {
		r.serveUnregisteredGroup(w, req, group, "get")
		return
	}
	setRoute(req, routeBackend)
	if req.Method != http.MethodGet && req.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "OpenAPI documents are read-only", http.StatusMethodNotAllowed)
		return
	}

	cacheKey := group + "/" + version
	// A caller-scoped backend may answer each caller differently, and the
	// cache is shared.
	cacheableRequest := !entry.callerScoped && req.Method == http.MethodGet && req.Header.Get("Range") == ""
	if cached, ok := r.openapiDocs.Load(cacheKey); ok && cacheableRequest {
		c := cached.(openapiCacheEntry)
		if c.key == entry.key && c.accept == req.Header.Get("Accept") && c.encoding == req.Header.Get("Accept-Encoding") {
			maps.Copy(w.Header(), c.header.Clone())
			w.Header().Set("ETag", c.etag)
			if req.Header.Get("If-None-Match") == c.etag {
				w.WriteHeader(http.StatusNotModified)
				return
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(c.body)
			return
		}
	}

	// Cache miss or stale key: proxy through the breaker and capture the
	// response so it can be cached. Conditional headers are stripped only
	// when this cache may store the response; otherwise the backend answers
	// them, as a caller-scoped backend's own cache does.
	proxyReq := req.Clone(req.Context())
	if cacheableRequest {
		stripConditionalHeaders(proxyReq)
	}
	stripHashQueryParam(proxyReq)
	rec := newCaptureWriter(maxCachedOpenAPIDocBytes, w)
	entry.serve(group, rec, proxyReq)
	if rec.overflowed {
		return // too large to cache; already streamed to the client
	}

	maps.Copy(w.Header(), rec.header)
	// Private schemas pass through authorization on every request. Honor their
	// private/no-cache responses instead of bypassing that check on a cache hit.
	if rec.statusCode == http.StatusOK && cacheableRequest && cacheableOpenAPIResponse(rec.header) {
		etag := quoteETag(hashHexBytes([]byte(entry.key), []byte{0}, rec.body.Bytes()))
		r.storeOpenAPIDoc(group, cacheKey, openapiCacheEntry{
			key: entry.key, etag: etag, body: rec.body.Bytes(), header: openAPICacheHeaders(rec.header),
			accept: req.Header.Get("Accept"), encoding: req.Header.Get("Accept-Encoding"),
		})
		w.Header().Set("ETag", etag)
	}
	w.WriteHeader(rec.statusCode)
	_, _ = w.Write(rec.body.Bytes())
}

// parseOpenAPIGroupVersionPath extracts group and version from a path of the
// exact shape "/openapi/v3/apis/<group>/<version>". ok is false for the root
// "/openapi/v3" doc itself, a trailing slash, a missing version, extra
// segments, or the k8s "api/<version>" core-group shape (not applicable here
// — this router has no core group).
func parseOpenAPIGroupVersionPath(path string) (group, version string, ok bool) {
	rest, hasPrefix := strings.CutPrefix(path, openapiV3Prefix+"/")
	if !hasPrefix || rest == "" {
		return "", "", false
	}
	rest, hasAPIs := strings.CutPrefix(rest, "apis/")
	if !hasAPIs || rest == "" {
		return "", "", false
	}
	group, version, ok = strings.Cut(rest, "/")
	if !ok || group == "" || version == "" || strings.Contains(version, "/") {
		return "", "", false
	}
	return group, version, true
}

// retainOpenAPIDocs drops cached OpenAPI documents for groups that are no
// longer served, or whose backend changed and would miss the cache anyway.
func (r *GrafanaRouter) retainOpenAPIDocs(snapshot map[string]servingEntry) {
	r.openapiDocsMu.Lock()
	defer r.openapiDocsMu.Unlock()
	r.openapiDocs.Range(func(k, v any) bool {
		group, _, _ := strings.Cut(k.(string), "/")
		if served, ok := snapshot[group]; !ok || served.key != v.(openapiCacheEntry).key {
			r.openapiDocs.Delete(k)
		}
		return true
	})
}

// storeOpenAPIDoc caches a fetched document, unless the group's backend
// changed or went away while it was being fetched.
func (r *GrafanaRouter) storeOpenAPIDoc(group, cacheKey string, doc openapiCacheEntry) {
	r.openapiDocsMu.Lock()
	defer r.openapiDocsMu.Unlock()
	if current, ok := (*r.snapshot.Load())[group]; !ok || current.key != doc.key {
		return
	}
	r.openapiDocs.Store(cacheKey, doc)
}
