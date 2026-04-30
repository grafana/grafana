package features

import (
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/puzpuzpuz/xsync/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
