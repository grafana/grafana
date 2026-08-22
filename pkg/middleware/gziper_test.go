package middleware

import (
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/web"
)

// TestGziperHeadRequestsDoNotCompress covers gh #130649: every HEAD request
// with Accept-Encoding: gzip leaked one pgzip writer goroutine because the
// web.ResponseWriter reports a (0, nil) short write for HEAD, and pgzip skips
// the close path that releases its writer goroutine on a short write.
func TestGziperHeadRequestsDoNotCompress(t *testing.T) {
	var gotEncoding string
	var gotWrites int
	handler := Gziper()(http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		gotEncoding = rw.Header().Get("Content-Encoding")
		_, _ = rw.Write([]byte("body"))
		gotWrites++
	}))

	req := httptest.NewRequest(http.MethodHead, "/d/abc/dash", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(web.Rw(rec, req), req)

	require.Empty(t, gotEncoding, "HEAD responses must not be gzip-compressed")
	require.Equal(t, 1, gotWrites, "the handler must still run exactly once")
}

// TestGziperHeadRequestsLeakNoGoroutines verifies the goroutine count stays
// flat across repeated HEAD requests with gzip accepted.
func TestGziperHeadRequestsLeakNoGoroutines(t *testing.T) {
	handler := Gziper()(http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		_, _ = rw.Write([]byte("body"))
	}))

	run := func() {
		req := httptest.NewRequest(http.MethodHead, "/d/abc/dash", nil)
		req.Header.Set("Accept-Encoding", "gzip")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(web.Rw(rec, req), req)
		require.Equal(t, http.StatusOK, rec.Code)
	}

	run()
	runtime.GC()
	before := runtime.NumGoroutine()
	for i := 0; i < 100; i++ {
		run()
	}
	runtime.GC()
	after := runtime.NumGoroutine()

	require.LessOrEqual(t, after, before+5, "goroutine count grew across HEAD requests: before=%d after=%d", before, after)
}

// TestGziperGetRequestsStillCompress guards the normal path.
func TestGziperGetRequestsStillCompress(t *testing.T) {
	handler := Gziper()(http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		_, _ = rw.Write([]byte(strings.Repeat("a", 1024)))
	}))

	req := httptest.NewRequest(http.MethodGet, "/d/abc/dash", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(web.Rw(rec, req), req)

	require.Equal(t, "gzip", rec.Header().Get("Content-Encoding"))
	require.NotEmpty(t, rec.Body.Bytes())
}
