package gogit

import (
	"fmt"
	"io"
	"net/http"
	"sync/atomic"
)

var errBytesLimitExceeded = fmt.Errorf("bytes limit exceeded")

// ByteLimitedTransport wraps http.RoundTripper to enforce a max byte limit
type ByteLimitedTransport struct {
	Transport http.RoundTripper
	Limit     int64
	Bytes     int64
}

// NewByteLimitedTransport creates a new ByteLimitedTransport with the specified transport and byte limit.
// If transport is nil, http.DefaultTransport will be used.
func NewByteLimitedTransport(transport http.RoundTripper, limit int64) *ByteLimitedTransport {
	if transport == nil {
		transport = http.DefaultTransport
	}
	return &ByteLimitedTransport{
		Transport: transport,
		Limit:     limit,
		Bytes:     0,
	}
}

// RoundTrip tracks downloaded bytes and aborts if limit is exceeded
func (b *ByteLimitedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	resp, err := b.Transport.RoundTrip(req)
	if err != nil {
		return nil, err
	}

	// Wrap response body to track bytes read
	resp.Body = &byteLimitedReader{
		reader: resp.Body,
		limit:  b.Limit,
		bytes:  &b.Bytes,
	}

	return resp, nil
}

// byteLimitedReader tracks and enforces a download limit
type byteLimitedReader struct {
	reader io.ReadCloser
	limit  int64
	bytes  *int64
}

func (r *byteLimitedReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	if err != nil {
		return n, err
	}

	if atomic.AddInt64(r.bytes, int64(n)) > r.limit {
		return 0, errBytesLimitExceeded
	}

	return n, nil
}

func (r *byteLimitedReader) Close() error {
	return r.reader.Close()
}
