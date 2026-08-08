package features

import (
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/puzpuzpuz/xsync/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/singleflight"
)

// fakeTransport is an http.RoundTripper that returns a fixed response and counts calls.
type fakeTransport struct {
	calls  int
	status int
}

func (f *fakeTransport) RoundTrip(*http.Request) (*http.Response, error) {
	f.calls++
	return &http.Response{
		StatusCode: f.status,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(`{"key":"myFlag","value":true,"reason":"STATIC","variant":"true"}`)),
	}, nil
}

func newTestRoundTripper(ttl time.Duration, next http.RoundTripper) *cachedRoundTripper {
	return &cachedRoundTripper{
		next:  next,
		cache: xsync.NewMap[uint64, *cachedEntry](),
		ttl:   ttl,
		sf:    &singleflight.Group{},
	}
}

func makeReq(t *testing.T, url, body string) *http.Request {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(body))
	require.NoError(t, err)
	return req
}

func TestCachedRoundTripperCacheHit(t *testing.T) {
	backend := &fakeTransport{status: 200}
	rt := newTestRoundTripper(time.Minute, backend)

	resp1, err := rt.RoundTrip(makeReq(t, "http://localhost/ofrep/v1/evaluate/flags/myFlag", `{"context":{"namespace":"stack-1"}}`))
	require.NoError(t, err)
	defer func() { _ = resp1.Body.Close() }()

	resp2, err := rt.RoundTrip(makeReq(t, "http://localhost/ofrep/v1/evaluate/flags/myFlag", `{"context":{"namespace":"stack-1"}}`))
	require.NoError(t, err)
	defer func() { _ = resp2.Body.Close() }()

	assert.Equal(t, 1, backend.calls)
	assert.Equal(t, 200, resp2.StatusCode)
	body, err := io.ReadAll(resp2.Body)
	require.NoError(t, err)
	assert.JSONEq(t, `{"key":"myFlag","value":true,"reason":"STATIC","variant":"true"}`, string(body))
}

func TestCachedRoundTripperExpiredEntry(t *testing.T) {
	backend := &fakeTransport{status: 200}
	rt := newTestRoundTripper(-time.Second, backend) // negative TTL means entries are already expired on insertion

	resp1, err := rt.RoundTrip(makeReq(t, "http://localhost/ofrep/v1/evaluate/flags/myFlag", `{"context":{}}`))
	require.NoError(t, err)
	defer func() { _ = resp1.Body.Close() }()

	resp2, err := rt.RoundTrip(makeReq(t, "http://localhost/ofrep/v1/evaluate/flags/myFlag", `{"context":{}}`))
	require.NoError(t, err)
	defer func() { _ = resp2.Body.Close() }()

	assert.Equal(t, 2, backend.calls)
	assert.Equal(t, 200, resp2.StatusCode)
	body, err := io.ReadAll(resp2.Body)
	require.NoError(t, err)
	assert.JSONEq(t, `{"key":"myFlag","value":true,"reason":"STATIC","variant":"true"}`, string(body))
}

func TestCachedRoundTripperNon2xxNotCached(t *testing.T) {
	backend := &fakeTransport{status: 429}
	rt := newTestRoundTripper(time.Minute, backend)

	resp1, err := rt.RoundTrip(makeReq(t, "http://localhost/ofrep/v1/evaluate/flags/myFlag", `{"context":{}}`))
	require.NoError(t, err)
	defer func() { _ = resp1.Body.Close() }()

	resp2, err := rt.RoundTrip(makeReq(t, "http://localhost/ofrep/v1/evaluate/flags/myFlag", `{"context":{}}`))
	require.NoError(t, err)
	defer func() { _ = resp2.Body.Close() }()

	assert.Equal(t, 2, backend.calls)
	assert.Equal(t, 429, resp2.StatusCode)
}

func TestCachedRoundTripperDifferentFlagsCachedIndependently(t *testing.T) {
	backend := &fakeTransport{status: 200}
	rt := newTestRoundTripper(time.Minute, backend)

	resp1, err := rt.RoundTrip(makeReq(t, "http://localhost/ofrep/v1/evaluate/flags/flagA", `{"context":{}}`))
	require.NoError(t, err)
	defer func() { _ = resp1.Body.Close() }()

	resp2, err := rt.RoundTrip(makeReq(t, "http://localhost/ofrep/v1/evaluate/flags/flagB", `{"context":{}}`))
	require.NoError(t, err)
	defer func() { _ = resp2.Body.Close() }()

	assert.Equal(t, 2, backend.calls)
}

func TestCachedRoundTripperDifferentTenantsCachedIndependently(t *testing.T) {
	backend := &fakeTransport{status: 200}
	rt := newTestRoundTripper(time.Minute, backend)

	resp1, err := rt.RoundTrip(makeReq(t, "http://localhost/ofrep/v1/evaluate/flags/myFlag", `{"context":{"namespace":"stack-1"}}`))
	require.NoError(t, err)
	defer func() { _ = resp1.Body.Close() }()

	resp2, err := rt.RoundTrip(makeReq(t, "http://localhost/ofrep/v1/evaluate/flags/myFlag", `{"context":{"namespace":"stack-2"}}`))
	require.NoError(t, err)
	defer func() { _ = resp2.Body.Close() }()

	assert.Equal(t, 2, backend.calls)
}

type concurrentFakeTransport struct {
	called  int32
	barrier chan struct{}
}

func (c *concurrentFakeTransport) RoundTrip(*http.Request) (*http.Response, error) {
	atomic.AddInt32(&c.called, 1)
	<-c.barrier
	return &http.Response{
		StatusCode: 200,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(`{"key":"myFlag","value":true,"reason":"STATIC","variant":"true"}`)),
	}, nil
}

func TestCachedRoundTripperConcurrentRequests(t *testing.T) {
	barrier := make(chan struct{})
	backend := &concurrentFakeTransport{barrier: barrier}
	rt := newTestRoundTripper(time.Minute, backend)

	const numReqs = 3
	var wg sync.WaitGroup
	wg.Add(numReqs)

	results := make([]string, numReqs)
	errs := make([]error, numReqs)

	for i := 0; i < numReqs; i++ {
		go func(idx int) {
			defer wg.Done()
			req := makeReq(t, "http://localhost/ofrep/v1/evaluate/flags/myFlag", `{"context":{"namespace":"stack-1"}}`)
			resp, err := rt.RoundTrip(req)
			if err != nil {
				errs[idx] = err
				return
			}
			defer func() { _ = resp.Body.Close() }()
			body, err := io.ReadAll(resp.Body)
			if err != nil {
				errs[idx] = err
				return
			}
			results[idx] = string(body)
		}(i)
	}

	// Give the goroutines a moment to start and enter RoundTrip/block on the barrier
	time.Sleep(50 * time.Millisecond)
	close(barrier) // release the barrier

	wg.Wait()

	// Assert backend was called only once
	assert.Equal(t, int32(1), atomic.LoadInt32(&backend.called))

	// Assert all callers got the correct result
	for i := 0; i < numReqs; i++ {
		require.NoError(t, errs[i])
		assert.JSONEq(t, `{"key":"myFlag","value":true,"reason":"STATIC","variant":"true"}`, results[i])
	}
}
