package gogit

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockTransport struct {
	response *http.Response
	err      error
}

func (m *mockTransport) RoundTrip(*http.Request) (*http.Response, error) {
	return m.response, m.err
}

func TestNewByteLimitedTransport(t *testing.T) {
	tests := []struct {
		name      string
		transport http.RoundTripper
		limit     int64
	}{
		{
			name:      "with custom transport",
			transport: &mockTransport{},
			limit:     1000,
		},
		{
			name:      "with nil transport",
			transport: nil,
			limit:     1000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			blt := NewByteLimitedTransport(tt.transport, tt.limit)
			assert.NotNil(t, blt)
			assert.Equal(t, tt.limit, blt.Limit)
			assert.Equal(t, int64(0), blt.Bytes)

			if tt.transport == nil {
				assert.NotNil(t, blt.Transport)
				assert.NotEqual(t, http.DefaultTransport, blt.Transport)
			} else {
				assert.Equal(t, tt.transport, blt.Transport)
			}
		})
	}
}

func TestByteLimitedTransport_RoundTrip(t *testing.T) {
	tests := []struct {
		name          string
		responseBody  string
		limit         int64
		expectedError error
	}{
		{
			name:          "under limit",
			responseBody:  "small response",
			limit:         100,
			expectedError: nil,
		},
		{
			name:          "exceeds limit",
			responseBody:  "this response will exceed the byte limit",
			limit:         10,
			expectedError: errBytesLimitExceeded,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResp := &http.Response{
				Body: io.NopCloser(bytes.NewBufferString(tt.responseBody)),
			}
			mockTransport := &mockTransport{response: mockResp}

			blt := NewByteLimitedTransport(mockTransport, tt.limit)
			resp, err := blt.RoundTrip(&http.Request{})
			require.NoError(t, err)
			defer func() {
				closeErr := resp.Body.Close()
				assert.NoError(t, closeErr, "failed to close response body")
			}()

			data, err := io.ReadAll(resp.Body)
			if tt.expectedError != nil {
				assert.True(t, errors.Is(err, tt.expectedError), "expected error %v, got %v", tt.expectedError, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.responseBody, string(data))
			}
		})
	}
}

func TestByteLimitedReader_Close(t *testing.T) {
	mockBody := io.NopCloser(bytes.NewBufferString("test"))
	var byteCount int64
	reader := &byteLimitedReader{
		reader: mockBody,
		limit:  100,
		bytes:  &byteCount,
	}

	err := reader.Close()
	assert.NoError(t, err)
}

func TestByteLimitedReader_AtomicCounting(t *testing.T) {
	var byteCount int64
	reader := &byteLimitedReader{
		reader: io.NopCloser(bytes.NewBufferString("test data")),
		limit:  5,
		bytes:  &byteCount,
	}

	// First read should succeed
	buf := make([]byte, 4)
	n, err := reader.Read(buf)
	assert.NoError(t, err)
	assert.Equal(t, 4, n)

	// Second read should fail due to limit
	n, err = reader.Read(buf)
	assert.True(t, errors.Is(err, errBytesLimitExceeded), "expected error %v, got %v", errBytesLimitExceeded, err)
	assert.Equal(t, 0, n)

	// Verify atomic counter
	assert.Greater(t, atomic.LoadInt64(&byteCount), int64(5))
}
