package router

import (
	"context"
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
	// What an entry costs beyond its key, headers and body: the LRU's own
	// bookkeeping. It also caps the number of entries a budget allows.
	stackDiscoveryEntryOverhead = 512
	// Only satisfies lru.New: the byte budget bounds the cache, and the
	// default budget holds at most this many entries.
	maxSingleTenantDiscoveryCacheEntries = defaultSingleTenantDiscoveryCacheBytes / stackDiscoveryEntryOverhead
	// Bounds a fetch shared by every caller waiting on it. Each caller still
	// stops waiting when its own request ends.
	singleTenantDiscoveryFetchTimeout = 30 * time.Second
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
// good entry. It is bounded by the total size of its entries, keys and
// headers included, since callers choose the keys.
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
	size      int
	// oversized marks a document too large to hold, which callers stream
	// from the stack instead of waiting on a shared fetch.
	oversized bool
}

func newStackDiscoveryCache(limit int) (*stackDiscoveryCache, error) {
	c := &stackDiscoveryCache{limit: limit}
	entries, err := lru.NewWithEvict(maxSingleTenantDiscoveryCacheEntries, func(_ string, e stackDiscoveryEntry) {
		c.bytes -= e.size
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
	entry.size = stackDiscoveryEntryOverhead + len(key) + len(entry.body) + len(entry.etag)
	for name, values := range entry.header {
		entry.size += len(name)
		for _, value := range values {
			entry.size += len(value)
		}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	// Remove first, so that the evict callback subtracts a replaced entry.
	c.entries.Remove(key)
	if entry.size > c.limit {
		// It could never fit, and making room would evict every other stack's
		// entries before dropping it too.
		return
	}
	c.entries.Add(key, entry)
	c.bytes += entry.size
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

// cacheableDiscoveryRequest reports whether a discovery request may be served
// from the cache. Discovery reads no query parameter, and forwardDiscovery
// strips OpenAPI's hash, so any query only adds keys for callers to fill the
// cache with.
func cacheableDiscoveryRequest(req *http.Request) bool {
	return req.Method == http.MethodGet && req.Header.Get("Range") == "" && req.URL.RawQuery == ""
}

// fetchedStackDiscovery is the result of one fetch, shared by every caller
// that waited on it.
type fetchedStackDiscovery struct {
	stored     bool // the response was cached as entry
	entry      stackDiscoveryEntry
	status     int
	header     http.Header
	overflowed bool
}

// forwardDiscovery serves a discovery request from the cache shared by
// everyone the same stack serves. Concurrent misses share one fetch, and its
// response reaches the others only when it was cacheable: anything else was
// an answer for the caller who fetched it, so each other caller fetches its
// own.
func (st *singleTenantFallback) forwardDiscovery(host *singleTenantTarget, w http.ResponseWriter, req *http.Request) {
	// A stack answers an OpenAPI hash that is no longer its document's with a
	// redirect, which the router rejects as a 502. Clients get hashes from
	// /openapi/v3 indexes cached before a stack changed, so never send one;
	// the router's own OpenAPI path strips it too.
	if req.URL.Query().Has("hash") {
		req = req.Clone(req.Context())
		stripHashQueryParam(req)
	}
	if st.discoveryDocs == nil || !cacheableDiscoveryRequest(req) {
		st.forward(host, "", w, req, nil)
		return
	}
	key := stackDiscoveryKey(host, req)
	if entry, ok := st.discoveryDocs.get(key); ok {
		if entry.oversized {
			st.forward(host, "", w, req, nil)
			return
		}
		st.discoveryHits.Add(1)
		serveStackDiscovery(w, req, entry.header.Clone(), http.StatusOK, entry)
		return
	}
	st.discoveryMisses.Add(1)

	// The fetch runs on its own goroutine; receiving its result orders this
	// read after the write.
	fetched := false
	results := st.discoveryFetches.DoChan(key, func() (any, error) {
		fetched = true
		return st.fetchDiscovery(host, key, req), nil
	})
	select {
	case <-req.Context().Done():
		return
	case result := <-results:
		f := result.Val.(fetchedStackDiscovery)
		switch {
		case f.stored:
			serveStackDiscovery(w, req, f.entry.header.Clone(), http.StatusOK, f.entry)
		case fetched && !f.overflowed:
			serveStackDiscovery(w, req, f.header, f.status, f.entry)
		default:
			// Too large to hold, or not for this caller: fetch with its own
			// credentials, streaming.
			st.forward(host, "", w, req, nil)
		}
	}
}

// fetchDiscovery fetches a discovery document for req, and caches it when the
// stack allows it to be shared.
func (st *singleTenantFallback) fetchDiscovery(host *singleTenantTarget, key string, req *http.Request) fetchedStackDiscovery {
	// Shared by every caller waiting on it, so one caller leaving must not
	// cancel it.
	ctx, cancel := context.WithTimeoutCause(context.WithoutCancel(req.Context()), singleTenantDiscoveryFetchTimeout, errRouterDeadline)
	defer cancel()
	// Without conditional headers the stack sends a body to cache, never a 304.
	proxyReq := req.Clone(ctx)
	stripConditionalHeaders(proxyReq)
	rec := newCaptureWriter(maxSingleTenantCachedDiscoveryBytes, nil)
	cacheable := false
	st.forward(host, "", rec, proxyReq, func(resp *http.Response) {
		cacheable = resp.StatusCode == http.StatusOK && cacheableOpenAPIResponse(resp.Header)
	})
	f := fetchedStackDiscovery{
		status: rec.statusCode, header: rec.header, overflowed: rec.overflowed,
		entry: stackDiscoveryEntry{body: rec.body.Bytes()},
	}
	if rec.overflowed {
		st.discoveryDocs.add(key, stackDiscoveryEntry{oversized: true, expiresAt: time.Now().Add(singleTenantDiscoveryCacheTTL)})
		return f
	}
	if cacheable && rec.statusCode == http.StatusOK {
		f.entry.header = openAPICacheHeaders(rec.header)
		f.entry.etag = quoteETag(hashHexBytes(rec.body.Bytes()))
		f.entry.expiresAt = time.Now().Add(singleTenantDiscoveryCacheTTL)
		st.discoveryDocs.add(key, f.entry)
		f.stored = true
	}
	return f
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
