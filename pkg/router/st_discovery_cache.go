package router

import (
	"maps"
	"net/http"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru/v2"
)

const (
	// Bounds how long a stack's discovery stays stale after it is upgraded.
	singleTenantDiscoveryCacheTTL = 5 * time.Minute
	// The discovery documents that all callers of all stacks share.
	defaultSingleTenantDiscoveryCacheBytes = 64 << 20
	// The byte budget bounds the cache; this only satisfies lru.New.
	maxSingleTenantDiscoveryCacheEntries = 1 << 20
)

// A larger document streams to the caller and is not cached, so that a few
// large OpenAPI documents can't evict every stack's root discovery. A
// variable so that tests can lower it.
var maxSingleTenantCachedDiscoveryBytes = 4 << 20

// stackDiscoveryCache holds discovery documents proxied from stacks, shared
// by every caller that the same stack serves. Like Kubernetes, a stack does
// not filter discovery per caller, and a document marked private, no-store or
// no-cache, or varying on more than Accept and Accept-Encoding, is never
// stored. Only a 200 is stored, so a caller who is refused never replaces a
// good entry. It is bounded by the total size of the documents it holds.
type stackDiscoveryCache struct {
	mu      sync.Mutex
	entries *lru.Cache[string, stackDiscoveryEntry]
	bytes   int
	limit   int
}

type stackDiscoveryEntry struct {
	header    http.Header
	body      []byte
	etag      string
	expiresAt time.Time
}

func newStackDiscoveryCache(limit int) (*stackDiscoveryCache, error) {
	c := &stackDiscoveryCache{limit: limit}
	entries, err := lru.NewWithEvict(maxSingleTenantDiscoveryCacheEntries, func(_ string, e stackDiscoveryEntry) {
		c.bytes -= len(e.body)
	})
	if err != nil {
		return nil, err
	}
	c.entries = entries
	return c, nil
}

func (c *stackDiscoveryCache) get(key string) (stackDiscoveryEntry, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries.Get(key)
	if ok && !time.Now().Before(entry.expiresAt) {
		c.entries.Remove(key)
		return stackDiscoveryEntry{}, false
	}
	return entry, ok
}

func (c *stackDiscoveryCache) add(key string, entry stackDiscoveryEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	// Remove first, so that the evict callback subtracts a replaced entry.
	c.entries.Remove(key)
	c.entries.Add(key, entry)
	c.bytes += len(entry.body)
	for c.bytes > c.limit && c.entries.Len() > 0 {
		c.entries.RemoveOldest()
	}
}

// stackDiscoveryKey identifies one representation of a discovery document on
// one destination. Callers of the same stack resolve to the same destination.
func stackDiscoveryKey(host *singleTenantTarget, req *http.Request) string {
	return host.url.String() + "\x00" + host.host + "\x00" + req.URL.Path + "?" + req.URL.RawQuery +
		"\x00" + req.Header.Get("Accept") + "\x00" + req.Header.Get("Accept-Encoding")
}

// forwardDiscovery serves a discovery request from the cache shared by
// everyone the same stack serves, and otherwise forwards it and caches the
// response.
func (st *singleTenantFallback) forwardDiscovery(host *singleTenantTarget, w http.ResponseWriter, req *http.Request) {
	if st.discoveryDocs == nil || req.Method != http.MethodGet || req.Header.Get("Range") != "" {
		st.forward(host, "", w, req, nil)
		return
	}
	key := stackDiscoveryKey(host, req)
	if entry, ok := st.discoveryDocs.get(key); ok {
		st.discoveryHits.Add(1)
		serveStackDiscovery(w, req, entry.header.Clone(), http.StatusOK, entry)
		return
	}
	st.discoveryMisses.Add(1)

	// Without conditional headers the stack sends a body to cache, never a 304.
	proxyReq := req.Clone(req.Context())
	stripConditionalHeaders(proxyReq)
	rec := newCaptureWriter(maxSingleTenantCachedDiscoveryBytes, w)
	cacheable := false
	st.forward(host, "", rec, proxyReq, func(resp *http.Response) {
		cacheable = resp.StatusCode == http.StatusOK && cacheableOpenAPIResponse(resp.Header)
	})
	if rec.overflowed {
		return // already streamed to the caller
	}
	entry := stackDiscoveryEntry{body: rec.body.Bytes()}
	if cacheable && rec.statusCode == http.StatusOK {
		entry.header = openAPICacheHeaders(rec.header)
		entry.etag = quoteETag(hashHex(rec.body.String()))
		entry.expiresAt = time.Now().Add(singleTenantDiscoveryCacheTTL)
		st.discoveryDocs.add(key, entry)
	}
	serveStackDiscovery(w, req, rec.header, rec.statusCode, entry)
}

// serveStackDiscovery writes a captured or cached discovery response. An entry
// with an ETag answers a matching conditional request with a 304.
func serveStackDiscovery(w http.ResponseWriter, req *http.Request, header http.Header, status int, entry stackDiscoveryEntry) {
	maps.Copy(w.Header(), header)
	if entry.etag != "" {
		w.Header().Set("ETag", entry.etag)
		if req.Header.Get("If-None-Match") == entry.etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
	}
	w.WriteHeader(status)
	_, _ = w.Write(entry.body)
}
