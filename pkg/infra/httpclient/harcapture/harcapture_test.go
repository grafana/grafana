package harcapture

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"sync"
	"testing"
	"time"

	"github.com/chromedp/cdproto/har"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWithCapture(t *testing.T) {
	ctx := context.Background()
	child, buf := WithCapture(ctx)

	require.NotNil(t, buf)
	assert.Same(t, buf, FromContext(child))
	assert.Nil(t, FromContext(ctx), "parent context must not carry the buffer")
}

func TestFromContext_absent(t *testing.T) {
	assert.Nil(t, FromContext(context.Background()))
}

func TestBuffer_Len(t *testing.T) {
	_, buf := WithCapture(context.Background())
	assert.Equal(t, 0, buf.Len())

	buf.AddEntry(newGetReq(t, "http://example.com"), okResp(200), time.Now(), time.Millisecond) //nolint:bodyclose
	assert.Equal(t, 1, buf.Len())
}

func TestBuffer_ToHAR_structure(t *testing.T) {
	_, buf := WithCapture(context.Background())

	req := newPostReq(t, "http://ds.example.com/query", `{"q":"test"}`)
	resp := okResp(200) //nolint:bodyclose
	resp.Body = io.NopCloser(bytes.NewBufferString(`{"data":"result"}`))
	resp.Header.Set("Content-Type", "application/json")

	buf.AddEntry(req, resp, time.Now(), 42*time.Millisecond)

	raw, err := buf.ToHAR()
	require.NoError(t, err)

	var doc har.HAR
	require.NoError(t, json.Unmarshal(raw, &doc))

	assert.Equal(t, "1.2", doc.Log.Version)
	require.Len(t, doc.Log.Entries, 1)

	e := doc.Log.Entries[0]
	assert.Equal(t, "POST", e.Request.Method)
	assert.Equal(t, "http://ds.example.com/query", e.Request.URL)
	assert.Equal(t, `{"q":"test"}`, e.Request.PostData.Text)
	assert.Equal(t, int64(200), e.Response.Status)
	assert.Equal(t, `{"data":"result"}`, e.Response.Content.Text)
	assert.InDelta(t, 42.0, e.Time, 1.0)
}

func TestBuffer_ToHAR_requestBodyRestored(t *testing.T) {
	_, buf := WithCapture(context.Background())

	req := newPostReq(t, "http://example.com", `body`)
	buf.AddEntry(req, okResp(200), time.Now(), time.Millisecond) //nolint:bodyclose

	// body must still be readable after AddEntry
	body, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	assert.Equal(t, "body", string(body))
}

func TestBuffer_ToHAR_responseBodyRestored(t *testing.T) {
	_, buf := WithCapture(context.Background())

	resp := okResp(200) //nolint:bodyclose
	resp.Body = io.NopCloser(bytes.NewBufferString("response"))
	buf.AddEntry(newGetReq(t, "http://example.com"), resp, time.Now(), time.Millisecond)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, "response", string(body))
}

func TestBuffer_ToHAR_responseBodyReadError_surfacedToCaller(t *testing.T) {
	_, buf := WithCapture(context.Background())

	wantErr := errors.New("read boom")
	resp := okResp(200) //nolint:bodyclose
	resp.Body = io.NopCloser(&partialThenErrorReader{data: []byte("partial"), err: wantErr})

	buf.AddEntry(newGetReq(t, "http://example.com"), resp, time.Now(), time.Millisecond)

	// The caller reads the captured bytes, then the original read error is re-surfaced rather
	// than being silently swallowed and replaced with a truncated-but-successful body.
	got, err := io.ReadAll(resp.Body)
	assert.Equal(t, "partial", string(got))
	assert.ErrorIs(t, err, wantErr)

	raw, e := buf.ToHAR()
	require.NoError(t, e)
	var doc har.HAR
	require.NoError(t, json.Unmarshal(raw, &doc))
	require.Len(t, doc.Log.Entries, 1)
	assert.Equal(t, "partial", doc.Log.Entries[0].Response.Content.Text)
}

func TestBuffer_ToHAR_requestBodyReadError_restored(t *testing.T) {
	_, buf := WithCapture(context.Background())

	wantErr := errors.New("req read boom")
	req := newGetReq(t, "http://example.com")
	req.Body = io.NopCloser(&partialThenErrorReader{data: []byte("partial-req"), err: wantErr})

	buf.AddEntry(req, okResp(200), time.Now(), time.Millisecond) //nolint:bodyclose

	// Symmetric with the response path: req.Body is restored (captured bytes then the error),
	// not left consumed.
	got, err := io.ReadAll(req.Body)
	assert.Equal(t, "partial-req", string(got))
	assert.ErrorIs(t, err, wantErr)
}

func TestBuffer_ToHAR_redactsSensitiveData(t *testing.T) {
	_, buf := WithCapture(context.Background())

	req := newGetReq(t, "http://ds.example.com/query?api_key=QUERYSECRET&X-Amz-Signature=AWSSIG&region=us-east-1")
	req.Header.Set("Authorization", "Bearer super-secret-token")
	req.Header.Set("X-Grafana-Id", "id-token-value")
	req.Header.Set("X-Amz-Security-Token", "AWSSESSION")
	req.Header.Set("Accept", "application/json")
	req.AddCookie(&http.Cookie{Name: "grafana_session", Value: "req-cookie-secret"})

	resp := okResp(200) //nolint:bodyclose
	resp.Header.Set("Set-Cookie", "grafana_session=resp-cookie-secret; Path=/")

	buf.AddEntry(req, resp, time.Now(), time.Millisecond)

	raw, err := buf.ToHAR()
	require.NoError(t, err)
	s := string(raw)

	// Secrets must not appear anywhere in the serialized HAR (headers, cookies, query, or URL).
	for _, secret := range []string{"super-secret-token", "id-token-value", "AWSSESSION", "QUERYSECRET", "AWSSIG", "req-cookie-secret", "resp-cookie-secret"} {
		assert.NotContains(t, s, secret, "secret leaked into HAR")
	}
	assert.Contains(t, s, redactedValue)
	// Non-sensitive values are preserved.
	assert.Contains(t, s, "us-east-1")
	assert.Contains(t, s, "application/json")
}

func TestBuffer_ToHAR_binaryResponseBody_base64(t *testing.T) {
	_, buf := WithCapture(context.Background())

	binary := []byte{0xff, 0xfe, 0x00, 0x01, 0x80, 0x02} // invalid UTF-8
	resp := okResp(200)                                  //nolint:bodyclose
	resp.Body = io.NopCloser(bytes.NewReader(binary))
	resp.Header.Set("Content-Type", "application/octet-stream")

	buf.AddEntry(newGetReq(t, "http://example.com"), resp, time.Now(), time.Millisecond)

	raw, err := buf.ToHAR()
	require.NoError(t, err)
	var doc har.HAR
	require.NoError(t, json.Unmarshal(raw, &doc))

	c := doc.Log.Entries[0].Response.Content
	assert.Equal(t, "base64", c.Encoding, "binary body flagged as base64")
	assert.Equal(t, int64(len(binary)), c.Size, "size reflects the raw byte length")

	decoded, err := base64.StdEncoding.DecodeString(c.Text)
	require.NoError(t, err)
	assert.Equal(t, binary, decoded, "binary body round-trips losslessly")
}

func TestBuffer_ToHAR_redactsURLsAndCredentials(t *testing.T) {
	_, buf := WithCapture(context.Background())

	// Inline credentials + a non-sensitive query on the request URL.
	req := newGetReq(t, "https://user:pass@ds.example.com/api?b=2&a=1")
	resp := okResp(302) //nolint:bodyclose
	// A redirect whose Location carries a secret in its query string.
	resp.Header.Set("Location", "https://idp.example.com/cb?access_token=SECRET&state=ok")

	buf.AddEntry(req, resp, time.Now(), time.Millisecond)

	raw, err := buf.ToHAR()
	require.NoError(t, err)
	s := string(raw)

	assert.NotContains(t, s, "user:pass", "inline URL credentials are dropped")
	assert.NotContains(t, s, "SECRET", "sensitive param in the redirect Location is redacted")
	assert.Contains(t, s, "state=ok", "non-sensitive redirect param is kept")

	var doc har.HAR
	require.NoError(t, json.Unmarshal(raw, &doc))
	// No sensitive request params -> the query is preserved verbatim (order not rewritten).
	assert.Equal(t, "https://ds.example.com/api?b=2&a=1", doc.Log.Entries[0].Request.URL)
	assert.NotContains(t, doc.Log.Entries[0].Response.RedirectURL, "SECRET")
}

func TestRedactHARDocument(t *testing.T) {
	doc := []byte(`{"log":{"entries":[{` +
		`"request":{"headers":[{"name":"Authorization","value":"Bearer SECRET"},{"name":"Accept","value":"application/json"}],` +
		`"queryString":[{"name":"api_key","value":"QSECRET"},{"name":"region","value":"eu"}],` +
		`"cookies":[{"name":"sess","value":"COOKIESECRET"}],"url":"https://u:p@h/x?api_key=QSECRET"},` +
		`"response":{"headers":[{"name":"Location","value":"https://idp/cb?access_token=RSECRET"}],"cookies":[]}` +
		`}]}}`)

	out := string(RedactHARDocument(doc))

	for _, secret := range []string{"Bearer SECRET", "QSECRET", "COOKIESECRET", "RSECRET", "u:p@"} {
		assert.NotContains(t, out, secret, "secret leaked through frame redaction")
	}
	assert.Contains(t, out, "application/json", "non-sensitive header preserved")
	assert.Contains(t, out, "region", "non-sensitive query preserved")

	// Unparseable input is dropped (fail closed), not returned unredacted.
	assert.Nil(t, RedactHARDocument([]byte("not har")))
	assert.Nil(t, RedactHARDocument([]byte(`{"notalog":1}`)))
}

func TestRedactedURLString_dropsFragment(t *testing.T) {
	// A #fragment can carry a token (OAuth implicit flow); it must be dropped, not passed through.
	u, err := url.Parse("https://idp.example.com/cb?state=ok#access_token=SECRET")
	require.NoError(t, err)
	out := redactedURLString(u)
	assert.NotContains(t, out, "SECRET")
	assert.NotContains(t, out, "access_token")
	assert.Equal(t, "https://idp.example.com/cb?state=ok", out)
}

func TestRedactURLValue_failsClosedOnUnparseable(t *testing.T) {
	// net/url.Parse rejects raw control characters; such a value can't be query-redacted, so it
	// must be dropped rather than passed through into a bundle meant for external sharing.
	bad := "https://idp.example.com/cb?access_token=SECRET\x7f"
	require.Error(t, func() error { _, err := url.Parse(bad); return err }(), "guard: value must be unparseable")

	assert.Equal(t, redactedValue, redactURLValue(bad))
	// The same must hold when the value arrives via a URL-valued header (Location/Referer/...).
	assert.Equal(t, redactedValue, redactHeader("Location", bad, nil))
	assert.NotContains(t, redactHeader("Referer", bad, nil), "SECRET")

	// A parseable URL is still query-redacted in place (not dropped wholesale).
	ok := redactHeader("Location", "https://idp.example.com/cb?access_token=SECRET&state=ok", nil)
	assert.NotContains(t, ok, "SECRET")
	assert.Contains(t, ok, "state=ok")
}

func TestToNameValues_sortedAndMultiValue(t *testing.T) {
	h := http.Header{
		"X-Zeta":  {"z"},
		"X-Alpha": {"a1", "a2"}, // repeated header values must all be preserved
	}

	assert.Equal(t, []*har.NameValuePair{
		{Name: "X-Alpha", Value: "a1"},
		{Name: "X-Alpha", Value: "a2"},
		{Name: "X-Zeta", Value: "z"},
	}, toNameValues(h, nil), "names sorted, one pair per value")
}

func TestBuffer_ToHAR_redactsCustomHeaders(t *testing.T) {
	_, buf := WithCapture(context.Background())
	// A datasource's custom HTTP headers carry secrets under arbitrary names not in the denylist.
	buf.MarkSensitiveHeaders("PRIVATE-TOKEN", "x-vault-token")

	req := newGetReq(t, "http://ds.example.com")
	req.Header.Set("PRIVATE-TOKEN", "glpat-SECRET")
	req.Header.Set("X-Vault-Token", "vault-SECRET") // canonicalization must still match
	req.Header.Set("Accept", "application/json")     // untouched header stays for fidelity

	buf.AddEntry(req, okResp(200), time.Now(), time.Millisecond) //nolint:bodyclose
	raw, err := buf.ToHAR()
	require.NoError(t, err)
	s := string(raw)

	assert.NotContains(t, s, "glpat-SECRET", "custom header value must be redacted")
	assert.NotContains(t, s, "vault-SECRET", "custom header value must be redacted (case-insensitive name)")
	assert.Contains(t, s, "application/json", "non-custom headers stay for diagnostic fidelity")
}

func TestBuffer_ToHAR_emptyHeaderValues_noPanic(t *testing.T) {
	_, buf := WithCapture(context.Background())
	req := newGetReq(t, "http://example.com")
	req.Header["X-Empty"] = []string{}                           // empty value slice — must not panic
	buf.AddEntry(req, okResp(200), time.Now(), time.Millisecond) //nolint:bodyclose
	_, err := buf.ToHAR()
	require.NoError(t, err)
}

func TestBuffer_ToHAR_nilResponse(t *testing.T) {
	_, buf := WithCapture(context.Background())
	// A transport-level failure yields a nil response; the entry must still serialize.
	buf.AddEntry(newGetReq(t, "http://example.com"), nil, time.Now(), time.Millisecond)

	raw, err := buf.ToHAR()
	require.NoError(t, err)

	var doc har.HAR
	require.NoError(t, json.Unmarshal(raw, &doc))
	require.Len(t, doc.Log.Entries, 1)
	assert.Equal(t, int64(0), doc.Log.Entries[0].Response.Status)
}

func TestBuffer_concurrentAddEntry(t *testing.T) {
	_, buf := WithCapture(context.Background())
	var wg sync.WaitGroup
	const n = 100
	wg.Add(n)
	for range n {
		go func() {
			defer wg.Done()
			buf.AddEntry(newGetReq(t, "http://example.com"), okResp(200), time.Now(), time.Millisecond) //nolint:bodyclose
		}()
	}
	wg.Wait()
	assert.Equal(t, n, buf.Len())
}

// --- helpers ---

func newGetReq(t *testing.T, url string) *http.Request {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	require.NoError(t, err)
	return req
}

func newPostReq(t *testing.T, url, body string) *http.Request {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBufferString(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	return req
}

func okResp(status int) *http.Response {
	return &http.Response{
		StatusCode: status,
		Status:     http.StatusText(status),
		Proto:      "HTTP/1.1",
		Header:     http.Header{},
		Body:       io.NopCloser(bytes.NewBufferString("")),
	}
}

// partialThenErrorReader yields data, then fails with err -- simulating a body read that breaks
// mid-stream (e.g. a dropped connection).
type partialThenErrorReader struct {
	data []byte
	err  error
	off  int
}

func (r *partialThenErrorReader) Read(p []byte) (int, error) {
	if r.off < len(r.data) {
		n := copy(p, r.data[r.off:])
		r.off += n
		return n, nil
	}
	return 0, r.err
}
