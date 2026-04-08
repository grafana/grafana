package features

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/cespare/xxhash/v2"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/puzpuzpuz/xsync/v4"
)

type cachedEntry struct {
	body    []byte
	status  int
	headers http.Header
	expiry  time.Time
}

type cachedRoundTripper struct {
	next  http.RoundTripper
	cache *xsync.Map[uint64, *cachedEntry]
	ttl   time.Duration
}

func (c *cachedRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	var bodyBytes []byte
	if req.Body != nil {
		var err error
		bodyBytes, err = io.ReadAll(req.Body)
		if err != nil {
			return nil, err
		}
		req.Body = io.NopCloser(bytes.NewReader(bodyBytes))
	}

	key := xxhash.Sum64String(req.URL.String() + string(bodyBytes))

	if entry, ok := c.cache.Load(key); ok && time.Now().Before(entry.expiry) {
		return entryToResponse(entry), nil
	}

	// TODO: concurrent requests with the same key all miss the cache and hit the backend. Add singleflight if this becomes a problem.
	resp, err := c.next.RoundTrip(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		defer func() { _ = resp.Body.Close() }()
		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}

		entry := &cachedEntry{
			body:    respBody,
			status:  resp.StatusCode,
			headers: resp.Header.Clone(),
			expiry:  time.Now().Add(c.ttl),
		}
		c.cache.Store(key, entry)

		return entryToResponse(entry), nil
	}

	return resp, nil
}

func entryToResponse(e *cachedEntry) *http.Response {
	return &http.Response{
		StatusCode: e.status,
		Status:     fmt.Sprintf("%d %s", e.status, http.StatusText(e.status)),
		Header:     e.headers.Clone(),
		Body:       io.NopCloser(bytes.NewReader(e.body)),
	}
}

func newCacheMiddleware(ttl time.Duration) sdkhttpclient.Middleware {
	cache := xsync.NewMap[uint64, *cachedEntry]()

	return sdkhttpclient.MiddlewareFunc(func(_ sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return &cachedRoundTripper{next: next, cache: cache, ttl: ttl}
	})
}
