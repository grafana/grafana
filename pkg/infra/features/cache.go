package features

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/cespare/xxhash/v2"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/puzpuzpuz/xsync/v4"
	"golang.org/x/sync/singleflight"
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
	sf    *singleflight.Group
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

	if c.sf == nil {
		c.sf = &singleflight.Group{}
	}

	keyStr := strconv.FormatUint(key, 16)

	type sfResult struct {
		body    []byte
		status  int
		headers http.Header
	}

	val, err, _ := c.sf.Do(keyStr, func() (any, error) {
		if entry, ok := c.cache.Load(key); ok && time.Now().Before(entry.expiry) {
			return &sfResult{
				body:    entry.body,
				status:  entry.status,
				headers: entry.headers,
			}, nil
		}

		resp, err := c.next.RoundTrip(req)
		if err != nil {
			return nil, err
		}
		defer func() { _ = resp.Body.Close() }()

		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}

		res := &sfResult{
			body:    respBody,
			status:  resp.StatusCode,
			headers: resp.Header.Clone(),
		}

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			entry := &cachedEntry{
				body:    respBody,
				status:  resp.StatusCode,
				headers: res.headers,
				expiry:  time.Now().Add(c.ttl),
			}
			c.cache.Store(key, entry)
		}

		return res, nil
	})

	if err != nil {
		return nil, err
	}

	res, ok := val.(*sfResult)
	if !ok {
		return nil, fmt.Errorf("unexpected singleflight result type: %T", val)
	}

	return &http.Response{
		StatusCode: res.status,
		Status:     fmt.Sprintf("%d %s", res.status, http.StatusText(res.status)),
		Header:     res.headers.Clone(),
		Body:       io.NopCloser(bytes.NewReader(res.body)),
	}, nil
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
		return &cachedRoundTripper{next: next, cache: cache, ttl: ttl, sf: &singleflight.Group{}}
	})
}
