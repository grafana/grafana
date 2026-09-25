package web

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func Test_responseWriter_WriteHeader(t *testing.T) {
	t.Run("it should set status code as expected", func(t *testing.T) {
		f := fakeResponseWriter{}
		rw := NewResponseWriter("GET", &f)
		rw.WriteHeader(200)
		require.Equal(t, 200, rw.Status())
		require.Equal(t, 200, f.Status)
	})

	t.Run("it should set status code to 500 if WriteHeader is called with invalid HTTP status", func(t *testing.T) {
		f := fakeResponseWriter{}
		rw := NewResponseWriter("GET", &f)
		rw.WriteHeader(0)
		require.Equal(t, 500, rw.Status())
		require.Equal(t, 500, f.Status)
	})
}

func Test_responseWriter_Write(t *testing.T) {
	body := []byte("a response body")

	t.Run("it should write the body and count its size", func(t *testing.T) {
		rec := httptest.NewRecorder()
		rw := NewResponseWriter("GET", rec)

		size, err := rw.Write(body)
		require.NoError(t, err)
		require.Equal(t, len(body), size)
		require.Equal(t, body, rec.Body.Bytes())
		require.Equal(t, len(body), rw.Size())
	})

	t.Run("it should drop the body of a HEAD response but report it as written", func(t *testing.T) {
		rec := httptest.NewRecorder()
		rw := NewResponseWriter("HEAD", rec)

		// Reporting fewer bytes than it was given makes every writer wrapped
		// around this one treat the response as a short write, which is how the
		// gzip middleware used to leak a goroutine per request (#130649).
		size, err := rw.Write(body)
		require.NoError(t, err)
		require.Equal(t, len(body), size)
		require.Zero(t, rec.Body.Len(), "a HEAD response carries no body")
		require.Zero(t, rw.Size(), "nothing was written to the wire")
	})

	t.Run("it should not fail an io.Copy of a HEAD response", func(t *testing.T) {
		rw := NewResponseWriter("HEAD", httptest.NewRecorder())

		written, err := io.Copy(rw, bytes.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, int64(len(body)), written)
	})
}

type fakeResponseWriter struct {
	Status int
}

func (f *fakeResponseWriter) Header() http.Header {
	return http.Header{}
}

func (f *fakeResponseWriter) Write([]byte) (int, error) {
	return 0, nil
}

func (f *fakeResponseWriter) WriteHeader(statusCode int) {
	f.Status = statusCode
}
