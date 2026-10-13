package middleware

import (
	"compress/gzip"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"go.uber.org/goleak"

	"github.com/grafana/grafana/pkg/web"
)

// Large enough for the compressor to write to the response before Close, so
// failing writers exercise error propagation back to the handler.
var gzipTestBody = []byte(strings.Repeat("grafana dashboard payload ", 20000))

func gzipTestHandler(t *testing.T, assertWriteError require.ErrorAssertionFunc) http.Handler {
	t.Helper()

	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		rw.Header().Set("Content-Type", "application/json")
		rw.Header().Set("Content-Length", "1234")
		_, err := rw.Write(gzipTestBody)
		assertWriteError(t, err)
	})
}

// serveGzipped runs a request through the gzip middleware the way the HTTP
// server does, with a web.ResponseWriter underneath it.
func serveGzipped(t *testing.T, method, url string, rw http.ResponseWriter, assertWriteError require.ErrorAssertionFunc) {
	t.Helper()

	req, err := http.NewRequest(method, url, nil)
	require.NoError(t, err)
	req.Header.Set("Accept-Encoding", "gzip")

	Gziper()(gzipTestHandler(t, assertWriteError)).ServeHTTP(web.NewResponseWriter(method, rw), req)
}

func TestGziper(t *testing.T) {
	t.Run("compresses a GET response", func(t *testing.T) {
		rec := httptest.NewRecorder()

		serveGzipped(t, http.MethodGet, "/d/abc/dash", rec, require.NoError)

		require.Equal(t, "gzip", rec.Header().Get("Content-Encoding"))
		require.Equal(t, "Accept-Encoding", rec.Header().Get("Vary"))
		require.Empty(t, rec.Header().Get("Content-Length"), "the compressed length is not known in advance")
		require.Less(t, rec.Body.Len(), len(gzipTestBody))

		reader, err := gzip.NewReader(rec.Body)
		require.NoError(t, err)
		body, err := io.ReadAll(reader)
		require.NoError(t, err)
		require.Equal(t, gzipTestBody, body)
	})

	t.Run("does not compress a HEAD response, but keeps the headers a GET would return", func(t *testing.T) {
		rec := httptest.NewRecorder()

		serveGzipped(t, http.MethodHead, "/d/abc/dash", rec, require.NoError)

		require.Equal(t, "gzip", rec.Header().Get("Content-Encoding"))
		require.Equal(t, "Accept-Encoding", rec.Header().Get("Vary"))
		require.Empty(t, rec.Header().Get("Content-Length"))
		require.Zero(t, rec.Body.Len(), "a HEAD response has no body")
	})

	t.Run("does not compress when the client does not accept gzip", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req, err := http.NewRequest(http.MethodGet, "/d/abc/dash", nil)
		require.NoError(t, err)

		Gziper()(gzipTestHandler(t, require.NoError)).ServeHTTP(web.NewResponseWriter(http.MethodGet, rec), req)

		require.Empty(t, rec.Header().Get("Content-Encoding"))
		require.Equal(t, gzipTestBody, rec.Body.Bytes())
	})

	t.Run("does not compress ignored paths", func(t *testing.T) {
		rec := httptest.NewRecorder()

		serveGzipped(t, http.MethodGet, "/metrics", rec, require.NoError)

		require.Empty(t, rec.Header().Get("Content-Encoding"))
		require.Equal(t, gzipTestBody, rec.Body.Bytes())
	})
}

// These cases previously leaked compressor goroutines with pgzip. Keep them as
// regression coverage when changing compression implementations.
func TestGziperDoesNotLeakGoroutines(t *testing.T) {
	const requests = 20

	t.Run("HEAD requests", func(t *testing.T) {
		defer goleak.VerifyNone(t, goleak.IgnoreCurrent())

		for range requests {
			serveGzipped(t, http.MethodHead, "/d/abc/dash", httptest.NewRecorder(), require.NoError)
		}
	})

	t.Run("responses the client disconnects from", func(t *testing.T) {
		defer goleak.VerifyNone(t, goleak.IgnoreCurrent())

		for range requests {
			serveGzipped(t, http.MethodGet, "/d/abc/dash", &brokenResponseWriter{failAfter: 1}, require.Error)
		}
	})

	t.Run("responses that are written short", func(t *testing.T) {
		defer goleak.VerifyNone(t, goleak.IgnoreCurrent())

		for range requests {
			serveGzipped(t, http.MethodGet, "/d/abc/dash", &brokenResponseWriter{failAfter: 1, short: true}, require.Error)
		}
	})
}

func TestGzipSink(t *testing.T) {
	t.Run("propagates a failed write", func(t *testing.T) {
		sink := &gzipSink{w: &brokenResponseWriter{}}

		n, err := sink.Write([]byte("compressed"))
		require.ErrorIs(t, err, errClientGone)
		require.Zero(t, n)
	})

	t.Run("reports a short write", func(t *testing.T) {
		sink := &gzipSink{w: &brokenResponseWriter{short: true}}

		n, err := sink.Write([]byte("compressed"))
		require.ErrorIs(t, err, io.ErrShortWrite)
		require.Zero(t, n)
	})

	t.Run("passes successful writes through", func(t *testing.T) {
		rec := httptest.NewRecorder()
		sink := &gzipSink{w: rec}

		n, err := sink.Write([]byte("compressed"))
		require.NoError(t, err)
		require.Equal(t, len("compressed"), n)
		require.Equal(t, "compressed", rec.Body.String())
	})
}

func TestGzipResponseWriterErrors(t *testing.T) {
	for _, tc := range []struct {
		name    string
		short   bool
		wantErr error
	}{
		{name: "client disconnect", wantErr: errClientGone},
		{name: "short write", short: true, wantErr: io.ErrShortWrite},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, failAfter := range []int{0, 1} {
				failed := &brokenResponseWriter{failAfter: failAfter, short: tc.short}
				rw := web.NewResponseWriter(http.MethodGet, failed)
				grw := &gzipResponseWriter{gzip.NewWriter(&gzipSink{w: rw}), rw}

				_, err := grw.Write(gzipTestBody)
				require.ErrorIs(t, err, tc.wantErr)
				writes := failed.writes
				_, err = grw.Write(gzipTestBody)
				require.ErrorIs(t, err, tc.wantErr)
				require.ErrorIs(t, grw.w.Close(), tc.wantErr)
				require.Equal(t, writes, failed.writes, "a writer that failed is not written to again")
			}
		})
	}
}

var errClientGone = errors.New("write tcp 10.0.0.1:3000->10.0.0.2:54321: write: broken pipe")

// brokenResponseWriter stops accepting writes after failAfter of them, the way
// the response writer of a client that has gone away does.
type brokenResponseWriter struct {
	failAfter int
	short     bool
	writes    int
	header    http.Header
}

func (w *brokenResponseWriter) Header() http.Header {
	if w.header == nil {
		w.header = http.Header{}
	}
	return w.header
}

func (w *brokenResponseWriter) Write(b []byte) (int, error) {
	w.writes++
	if w.writes <= w.failAfter {
		return len(b), nil
	}
	if w.short {
		return 0, nil
	}
	return 0, errClientGone
}

func (w *brokenResponseWriter) WriteHeader(int) {}
