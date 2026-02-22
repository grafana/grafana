package middleware

import (
	"compress/flate"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andybalholm/brotli"
	"github.com/klauspost/compress/zstd"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/web"
)

func TestNegotiateEncoding(t *testing.T) {
	tests := []struct {
		name           string
		acceptEncoding string
		expected       string
	}{
		{name: "empty header", acceptEncoding: "", expected: ""},
		{name: "gzip only", acceptEncoding: "gzip", expected: "gzip"},
		{name: "br only", acceptEncoding: "br", expected: "br"},
		{name: "zstd only", acceptEncoding: "zstd", expected: "zstd"},
		{name: "deflate only", acceptEncoding: "deflate", expected: "deflate"},
		{name: "unsupported encoding", acceptEncoding: "compress", expected: ""},
		{name: "wildcard selects best", acceptEncoding: "*", expected: "zstd"},
		{name: "multiple encodings picks best preference", acceptEncoding: "gzip, br", expected: "br"},
		{name: "quality values respected", acceptEncoding: "gzip;q=1.0, br;q=0.5", expected: "gzip"},
		{name: "all supported picks zstd", acceptEncoding: "gzip, br, zstd, deflate", expected: "zstd"},
		{name: "quality zero excluded", acceptEncoding: "gzip;q=0, br", expected: "br"},
		{name: "higher quality wins", acceptEncoding: "gzip;q=0.5, zstd;q=0.9, br;q=0.8", expected: "zstd"},
		{name: "equal quality uses preference order", acceptEncoding: "deflate;q=1.0, gzip;q=1.0, br;q=1.0, zstd;q=1.0", expected: "zstd"},
		{name: "whitespace handling", acceptEncoding: " gzip , br ; q=0.8 ", expected: "gzip"},
		{name: "identity not supported", acceptEncoding: "identity", expected: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := negotiateEncoding(tt.acceptEncoding)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// fakeResponseWriter wraps httptest.ResponseRecorder to satisfy web.ResponseWriter.
type fakeResponseWriter struct {
	*httptest.ResponseRecorder
}

func (f *fakeResponseWriter) Status() int                 { return f.Code }
func (f *fakeResponseWriter) Written() bool               { return f.Body.Len() > 0 }
func (f *fakeResponseWriter) Size() int                   { return f.Body.Len() }
func (f *fakeResponseWriter) Before(bf web.BeforeFunc)    {}
func (f *fakeResponseWriter) Flush()                      {}
func (f *fakeResponseWriter) CloseNotify() <-chan bool    { return make(<-chan bool) }
func (f *fakeResponseWriter) Unwrap() http.ResponseWriter { return f.ResponseRecorder }

func newFakeResponseWriter() *fakeResponseWriter {
	return &fakeResponseWriter{httptest.NewRecorder()}
}

func TestCompressorMiddleware(t *testing.T) {
	body := "Hello, this is a test response body for compression middleware testing."

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(body))
	})

	tests := []struct {
		name             string
		acceptEncoding   string
		expectedEncoding string
	}{
		{name: "gzip compression", acceptEncoding: "gzip", expectedEncoding: "gzip"},
		{name: "brotli compression", acceptEncoding: "br", expectedEncoding: "br"},
		{name: "zstd compression", acceptEncoding: "zstd", expectedEncoding: "zstd"},
		{name: "deflate compression", acceptEncoding: "deflate", expectedEncoding: "deflate"},
		{name: "no compression for unsupported", acceptEncoding: "compress", expectedEncoding: ""},
		{name: "no compression when empty", acceptEncoding: "", expectedEncoding: ""},
		{name: "best encoding selected", acceptEncoding: "gzip, br, zstd", expectedEncoding: "zstd"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/dashboards", nil)
			if tt.acceptEncoding != "" {
				req.Header.Set("Accept-Encoding", tt.acceptEncoding)
			}

			rw := newFakeResponseWriter()

			middleware := Compressor()(handler)
			middleware.ServeHTTP(rw, req)

			if tt.expectedEncoding == "" {
				assert.Empty(t, rw.Header().Get("Content-Encoding"))
				assert.Equal(t, body, rw.Body.String())
			} else {
				assert.Equal(t, tt.expectedEncoding, rw.Header().Get("Content-Encoding"))
				assert.Equal(t, "Accept-Encoding", rw.Header().Get("Vary"))

				// Decompress and verify body.
				decompressed := decompressBody(t, rw.Body.Bytes(), tt.expectedEncoding)
				assert.Equal(t, body, string(decompressed))
			}
		})
	}
}

func TestCompressorIgnoredPaths(t *testing.T) {
	body := "should not be compressed"

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(body))
	})

	ignoredPaths := []string{
		"/apis/something",
		"/api/datasources/1",
		"/api/plugins/list",
		"/api/plugin-proxy/foo",
		"/api/gnet/plugins",
		"/metrics",
		"/api/live/ws",
		"/api/live/push",
		"/something/resources/here",
	}

	for _, path := range ignoredPaths {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			req.Header.Set("Accept-Encoding", "gzip, br, zstd")

			rw := newFakeResponseWriter()
			middleware := Compressor()(handler)
			middleware.ServeHTTP(rw, req)

			assert.Empty(t, rw.Header().Get("Content-Encoding"), "path %s should not be compressed", path)
			assert.Equal(t, body, rw.Body.String())
		})
	}
}

func TestGziperBackwardCompatibility(t *testing.T) {
	// Gziper() should still work and return the Compressor middleware.
	body := "backward compat test"

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(body))
	})

	req := httptest.NewRequest(http.MethodGet, "/api/dashboards", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	rw := newFakeResponseWriter()

	middleware := Gziper()(handler)
	middleware.ServeHTTP(rw, req)

	assert.Equal(t, "gzip", rw.Header().Get("Content-Encoding"))
	decompressed := decompressBody(t, rw.Body.Bytes(), "gzip")
	assert.Equal(t, body, string(decompressed))
}

func decompressBody(t *testing.T, data []byte, encoding string) []byte {
	t.Helper()

	var reader io.Reader
	switch encoding {
	case "gzip":
		r, err := gzip.NewReader(bytesReader(data))
		require.NoError(t, err)
		defer func() { _ = r.Close() }()
		reader = r
	case "br":
		reader = brotli.NewReader(bytesReader(data))
	case "zstd":
		r, err := zstd.NewReader(bytesReader(data))
		require.NoError(t, err)
		defer r.Close()
		reader = r
	case "deflate":
		reader = flate.NewReader(bytesReader(data))
	default:
		t.Fatalf("unsupported encoding for decompression: %s", encoding)
	}

	result, err := io.ReadAll(reader)
	require.NoError(t, err)
	return result
}

func bytesReader(data []byte) io.Reader {
	return io.NopCloser(io.NewSectionReader(readerAtBytes(data), 0, int64(len(data))))
}

type readerAtBytes []byte

func (r readerAtBytes) ReadAt(p []byte, off int64) (n int, err error) {
	if off >= int64(len(r)) {
		return 0, io.EOF
	}
	n = copy(p, r[off:])
	if n < len(p) {
		err = io.EOF
	}
	return
}
