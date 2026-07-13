package harcapture

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/chromedp/cdproto/har"
)

// redactedValue replaces sensitive header/cookie/query values in captured traffic. Diagnostic
// bundles are meant to be shared (often externally), and the capture sits after the middlewares
// that inject auth headers, so credentials must never reach the archive.
const redactedValue = "[REDACTED]"

// sensitiveHeaders (canonical form) have their value redacted in captured HAR entries.
var sensitiveHeaders = map[string]struct{}{
	"Authorization":        {},
	"Proxy-Authorization":  {},
	"Www-Authenticate":     {},
	"Cookie":               {},
	"Set-Cookie":           {},
	"X-Api-Key":            {},
	"Api-Key":              {},
	"X-Auth-Token":         {},
	"X-Grafana-Id":         {},
	"X-Id-Token":           {},
	"X-Amz-Security-Token": {}, // AWS SigV4 header-based auth (IRSA / temporary credentials)
}

// sensitiveQueryParams (lower-case) have their value redacted in captured request URLs.
var sensitiveQueryParams = map[string]struct{}{
	"api_key":       {},
	"apikey":        {},
	"access_token":  {},
	"auth_token":    {},
	"token":         {},
	"private_token": {},
	"password":      {},
	"passwd":        {},
	"pwd":           {},
	"secret":        {},
	"client_secret": {},
	"signature":     {},
	"sig":           {}, // Azure SAS
	// AWS SigV4 presigned URLs
	"x-amz-signature":      {},
	"x-amz-credential":     {},
	"x-amz-security-token": {},
	// GCS signed URLs
	"x-goog-signature":  {},
	"x-goog-credential": {},
}

// urlValuedHeaders (canonical form) carry a URL whose query string may hold secrets; their value is
// query-redacted (rather than dropped) so the redirect/referrer target stays visible.
var urlValuedHeaders = map[string]struct{}{
	"Location":         {},
	"Content-Location": {},
	"Referer":          {},
}

func redactHeader(name, value string) string {
	canonical := http.CanonicalHeaderKey(name)
	if _, ok := sensitiveHeaders[canonical]; ok {
		return redactedValue
	}
	if _, ok := urlValuedHeaders[canonical]; ok {
		return redactURLValue(value)
	}
	return value
}

func redactQueryParam(name, value string) string {
	if _, ok := sensitiveQueryParams[strings.ToLower(name)]; ok {
		return redactedValue
	}
	return value
}

// redactedURLString renders u with inline credentials stripped and sensitive query params redacted.
// The query is only rewritten when a param was actually redacted, so an otherwise-untouched URL is
// preserved verbatim (parameter order and encoding unchanged).
func redactedURLString(u *url.URL) string {
	if u == nil {
		return ""
	}
	redacted := *u
	redacted.User = nil // drop any inline user:password@ credentials
	// Drop any #fragment: it can carry secrets (e.g. an OAuth implicit-flow #access_token=...) and
	// is query-shaped but not covered by the query-param redaction below, so fail closed.
	redacted.Fragment = ""
	redacted.RawFragment = ""
	if redacted.RawQuery != "" {
		changed := false
		out := url.Values{}
		for k, vals := range redacted.Query() {
			for _, v := range vals {
				rv := redactQueryParam(k, v)
				if rv != v {
					changed = true
				}
				out.Add(k, rv)
			}
		}
		if changed {
			redacted.RawQuery = out.Encode()
		}
	}
	return redacted.String()
}

// redactURLValue query-redacts a URL-valued string, failing closed: a value that can't be parsed
// can't be safely query-redacted, so it is dropped (redactedValue) rather than passed through. This
// matters because net/url.Parse rejects some inputs (e.g. a raw control character a misbehaving
// datasource might emit), and this bundle is meant for external sharing.
func redactURLValue(value string) string {
	u, err := url.Parse(value)
	if err != nil {
		return redactedValue
	}
	return redactedURLString(u)
}

// RedactHARDocument applies the same header/cookie/query/URL redaction used for in-process capture
// to a HAR 1.2 document produced elsewhere (e.g. an external plugin's __har__ frame), so
// externally-sourced entries don't leak secrets into a shared bundle. It returns nil if the document
// can't be parsed — failing closed (drop the frame) rather than merging a document we couldn't
// redact. (Request/response body payload redaction is out of scope, same as for in-process capture.)
func RedactHARDocument(doc []byte) []byte {
	var h har.HAR
	if err := json.Unmarshal(doc, &h); err != nil || h.Log == nil {
		return nil
	}
	for _, e := range h.Log.Entries {
		if e == nil {
			continue
		}
		if e.Request != nil {
			redactPairs(e.Request.Headers, redactHeader)
			redactPairs(e.Request.QueryString, redactQueryParam)
			redactCookieValues(e.Request.Cookies)
			if e.Request.URL != "" {
				e.Request.URL = redactURLValue(e.Request.URL)
			}
		}
		if e.Response != nil {
			redactPairs(e.Response.Headers, redactHeader)
			redactCookieValues(e.Response.Cookies)
			if e.Response.RedirectURL != "" {
				e.Response.RedirectURL = redactURLValue(e.Response.RedirectURL)
			}
		}
	}
	out, err := json.Marshal(h)
	if err != nil {
		// Fail closed: returning the original bytes here would leak the unredacted frame we just
		// failed to re-serialize into a bundle meant for external sharing.
		return nil
	}
	return out
}

func redactPairs(pairs []*har.NameValuePair, redact func(name, value string) string) {
	for _, p := range pairs {
		if p != nil {
			p.Value = redact(p.Name, p.Value)
		}
	}
}

func redactCookieValues(cookies []*har.Cookie) {
	for _, c := range cookies {
		if c != nil {
			c.Value = redactedValue
		}
	}
}

// encodeBody returns the HAR text representation of a body plus its encoding. Valid UTF-8 is stored
// as-is; binary payloads are base64-encoded (with encoding "base64") so they survive JSON marshaling
// intact instead of being corrupted by string() replacing invalid bytes with U+FFFD.
func encodeBody(body []byte) (text, encoding string) {
	if utf8.Valid(body) {
		return string(body), ""
	}
	return base64.StdEncoding.EncodeToString(body), "base64"
}

type contextKey struct{}

// Buffer collects HTTP request/response pairs as HAR 1.2 entries in memory.
type Buffer struct {
	mu      sync.Mutex
	entries []*har.Entry
}

// WithCapture returns a child context carrying a new Buffer and the buffer itself.
func WithCapture(ctx context.Context) (context.Context, *Buffer) {
	buf := &Buffer{}
	return context.WithValue(ctx, contextKey{}, buf), buf
}

// FromContext returns the Buffer stored in ctx, or nil if absent.
func FromContext(ctx context.Context) *Buffer {
	v, _ := ctx.Value(contextKey{}).(*Buffer)
	return v
}

// AddEntry appends a captured request/response pair. Thread-safe.
func (b *Buffer) AddEntry(req *http.Request, resp *http.Response, started time.Time, elapsed time.Duration) {
	e := buildEntry(req, resp, started, elapsed)
	b.mu.Lock()
	b.entries = append(b.entries, e)
	b.mu.Unlock()
}

// Len returns the number of captured entries. Thread-safe.
func (b *Buffer) Len() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.entries)
}

// ToHAR serializes the captured entries to HAR 1.2 JSON. The entry types come from
// github.com/chromedp/cdproto/har -- the same library the plugin SDK's e2e HAR storage uses -- so
// the output stays replay-compatible with that fixture format.
func (b *Buffer) ToHAR() ([]byte, error) {
	b.mu.Lock()
	entries := make([]*har.Entry, len(b.entries))
	copy(entries, b.entries)
	b.mu.Unlock()

	doc := har.HAR{
		Log: &har.Log{
			Version: "1.2",
			Creator: &har.Creator{Name: "Grafana", Version: "1.0"},
			Entries: entries,
		},
	}
	return json.Marshal(doc)
}

func buildEntry(req *http.Request, resp *http.Response, started time.Time, elapsed time.Duration) *har.Entry {
	reqHeaders := toNameValues(req.Header)

	query := req.URL.Query()
	queryKeys := make([]string, 0, len(query))
	for k := range query {
		queryKeys = append(queryKeys, k)
	}
	sort.Strings(queryKeys)
	queryString := make([]*har.NameValuePair, 0, len(query))
	for _, k := range queryKeys {
		for _, v := range query[k] {
			queryString = append(queryString, &har.NameValuePair{Name: k, Value: redactQueryParam(k, v)})
		}
	}

	var pd *har.PostData
	var reqBodySize int64
	if req.Body != nil {
		body, readErr := io.ReadAll(req.Body)
		if readErr != nil {
			// Mirror the response-body path: restore the captured (partial) bytes followed by the
			// error rather than leaving req.Body consumed, so a caller of this shared helper can
			// still read the body and observe the failure.
			req.Body = io.NopCloser(io.MultiReader(bytes.NewReader(body), &errorReader{err: readErr}))
		} else {
			req.Body = io.NopCloser(bytes.NewReader(body))
			reqBodySize = int64(len(body))
			if len(body) > 0 {
				// HAR PostData has no encoding field, so a binary request body is base64-encoded to
				// avoid corruption on marshal (datasource request bodies are text in practice).
				text, _ := encodeBody(body)
				pd = &har.PostData{
					MimeType: req.Header.Get("Content-Type"),
					Text:     text,
				}
			}
		}
	}

	// Content is required by the HAR spec and dereferenced unconditionally by the SDK's replay, so
	// always attach a (possibly empty) Content, even for transport failures with no response body.
	harResp := &har.Response{HeadersSize: -1, Content: &har.Content{}}
	if resp != nil {
		harResp.Status = int64(resp.StatusCode)
		harResp.StatusText = resp.Status
		harResp.HTTPVersion = resp.Proto
		harResp.Headers = toNameValues(resp.Header)
		harResp.Cookies = toCookies(resp.Cookies())
		if loc := resp.Header.Get("Location"); loc != "" {
			harResp.RedirectURL = redactURLValue(loc)
		}
		if resp.Body != nil {
			// Drain then Close the original transport body so its connection is returned to the
			// idle pool (per the net/http contract), then hand the caller a fresh reader over the
			// captured bytes.
			body, readErr := io.ReadAll(resp.Body)
			_ = resp.Body.Close()
			if readErr != nil {
				// Preserve the original read failure for the caller: replay the captured bytes,
				// then surface the same error rather than silently substituting a truncated body.
				resp.Body = io.NopCloser(io.MultiReader(bytes.NewReader(body), &errorReader{err: readErr}))
			} else {
				resp.Body = io.NopCloser(bytes.NewReader(body))
			}
			harResp.BodySize = int64(len(body))
			text, encoding := encodeBody(body)
			harResp.Content = &har.Content{
				Size:     int64(len(body)),
				MimeType: resp.Header.Get("Content-Type"),
				Text:     text,
				Encoding: encoding,
			}
		}
	}

	waitMs := float64(elapsed.Milliseconds())
	return &har.Entry{
		StartedDateTime: started.UTC().Format(time.RFC3339Nano),
		Time:            waitMs,
		Request: &har.Request{
			Method:      req.Method,
			URL:         redactedURLString(req.URL),
			HTTPVersion: req.Proto,
			Headers:     reqHeaders,
			QueryString: queryString,
			Cookies:     toCookies(req.Cookies()),
			PostData:    pd,
			BodySize:    reqBodySize,
			HeadersSize: -1,
		},
		Response: harResp,
		Cache:    &har.Cache{},
		Timings:  &har.Timings{Send: 0, Wait: waitMs, Receive: 0},
	}
}

// toNameValues flattens an http.Header into HAR name/value pairs, emitting one pair per value so
// repeated headers (e.g. multiple Set-Cookie) are preserved, in sorted order for deterministic output.
func toNameValues(h http.Header) []*har.NameValuePair {
	names := make([]string, 0, len(h))
	for name := range h {
		names = append(names, name)
	}
	sort.Strings(names)

	result := make([]*har.NameValuePair, 0, len(h))
	for _, name := range names {
		for _, v := range h[name] {
			result = append(result, &har.NameValuePair{Name: name, Value: redactHeader(name, v)})
		}
	}
	return result
}

// toCookies converts parsed HTTP cookies into HAR cookie entries (name/value), matching the SDK
// e2e HAR storage output so captured traffic stays replayable by the E2E fixture proxy.
func toCookies(cookies []*http.Cookie) []*har.Cookie {
	// Cookie values are session/auth tokens; keep the name for context but always redact the value.
	result := make([]*har.Cookie, 0, len(cookies))
	for _, c := range cookies {
		result = append(result, &har.Cookie{Name: c.Name, Value: redactedValue})
	}
	return result
}

// errorReader yields the wrapped error on Read. Used to re-surface a response-body read failure to
// the caller after the captured (partial) bytes have been replayed.
type errorReader struct{ err error }

func (r *errorReader) Read([]byte) (int, error) { return 0, r.err }
