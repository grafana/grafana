package middleware

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	gzip "github.com/klauspost/pgzip"
	"github.com/stretchr/testify/require"
	"go.uber.org/goleak"

	"github.com/grafana/grafana/pkg/web"
)

// Larger than pgzip's block size, so that the compressor writes to the response
// while the handler is still running.
var gzipTestBody = []byte(strings.Repeat("grafana dashboard payload ", 20000))

func gzipTestHandler(t *testing.T) http.Handler {
	t.Helper()

	return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		rw.Header().Set("Content-Type", "application/json")
		rw.Header().Set("Content-Length", "1234")
		_, err := rw.Write(gzipTestBody)
		require.NoError(t, err)
	})
}

// serveGzipped runs a request through the gzip middleware the way the HTTP
// server does, with a web.ResponseWriter underneath it.
func serveGzipped(t *testing.T, method, url string, rw http.ResponseWriter) {
	t.Helper()

	req, err := http.NewRequest(method, url, nil)
	require.NoError(t, err)
	req.Header.Set("Accept-Encoding", "gzip")

	Gziper()(gzipTestHandler(t)).ServeHTTP(web.NewResponseWriter(method, rw), req)
}

func TestGziper(t *testing.T) {
	t.Run("compresses a GET response", func(t *testing.T) {
		rec := httptest.NewRecorder()

		serveGzipped(t, http.MethodGet, "/d/abc/dash", rec)

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

		serveGzipped(t, http.MethodHead, "/d/abc/dash", rec)

		require.Equal(t, "gzip", rec.Header().Get("Content-Encoding"))
		require.Equal(t, "Accept-Encoding", rec.Header().Get("Vary"))
		require.Empty(t, rec.Header().Get("Content-Length"))
		require.Zero(t, rec.Body.Len(), "a HEAD response has no body")
	})

	t.Run("does not compress when the client does not accept gzip", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req, err := http.NewRequest(http.MethodGet, "/d/abc/dash", nil)
		require.NoError(t, err)

		Gziper()(gzipTestHandler(t)).ServeHTTP(web.NewResponseWriter(http.MethodGet, rec), req)

		require.Empty(t, rec.Header().Get("Content-Encoding"))
		require.Equal(t, gzipTestBody, rec.Body.Bytes())
	})

	t.Run("does not compress ignored paths", func(t *testing.T) {
		rec := httptest.NewRecorder()

		serveGzipped(t, http.MethodGet, "/metrics", rec)

		require.Empty(t, rec.Header().Get("Content-Encoding"))
		require.Equal(t, gzipTestBody, rec.Body.Bytes())
	})
}

// The compressor runs a goroutine that is only released when it is closed
// cleanly, and a response it cannot write leaves that goroutine parked forever -
// one per request, for as long as the process lives (#130649).
func TestGziperDoesNotLeakGoroutines(t *testing.T) {
	const requests = 20

	t.Run("HEAD requests", func(t *testing.T) {
		defer goleak.VerifyNone(t, goleak.IgnoreCurrent())

		for range requests {
			serveGzipped(t, http.MethodHead, "/d/abc/dash", httptest.NewRecorder())
		}
	})

	t.Run("responses the client disconnects from", func(t *testing.T) {
		defer goleak.VerifyNone(t, goleak.IgnoreCurrent())

		for range requests {
			serveGzipped(t, http.MethodGet, "/d/abc/dash", &brokenResponseWriter{failAfter: 1})
		}
	})

	t.Run("responses that are written short", func(t *testing.T) {
		defer goleak.VerifyNone(t, goleak.IgnoreCurrent())

		for range requests {
			serveGzipped(t, http.MethodGet, "/d/abc/dash", &brokenResponseWriter{failAfter: 1, short: true})
		}
	})
}

func TestGzipSink(t *testing.T) {
	t.Run("reports a failed write as complete and remembers the error", func(t *testing.T) {
		failed := &brokenResponseWriter{}
		sink := &gzipSink{w: failed}

		n, err := sink.Write([]byte("compressed"))
		require.NoError(t, err, "the error must not reach the compressor")
		require.Equal(t, len("compressed"), n, "a short write must not reach the compressor")
		require.ErrorIs(t, sink.err(), errClientGone)
	})

	t.Run("reports a short write as complete and remembers it", func(t *testing.T) {
		sink := &gzipSink{w: &brokenResponseWriter{short: true}}

		n, err := sink.Write([]byte("compressed"))
		require.NoError(t, err)
		require.Equal(t, len("compressed"), n)
		require.ErrorContains(t, sink.err(), "wrote 0 bytes of 10")
	})

	t.Run("keeps the first error and stops writing once a write failed", func(t *testing.T) {
		failed := &brokenResponseWriter{}
		sink := &gzipSink{w: failed}

		_, err := sink.Write([]byte("first"))
		require.NoError(t, err)
		_, err = sink.Write([]byte("second"))
		require.NoError(t, err)

		require.ErrorIs(t, sink.err(), errClientGone)
		require.Equal(t, 1, failed.writes, "a writer that failed is not written to again")
	})

	t.Run("passes successful writes through", func(t *testing.T) {
		rec := httptest.NewRecorder()
		sink := &gzipSink{w: rec}

		n, err := sink.Write([]byte("compressed"))
		require.NoError(t, err)
		require.Equal(t, len("compressed"), n)
		require.NoError(t, sink.err())
		require.Equal(t, "compressed", rec.Body.String())
	})
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
