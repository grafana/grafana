package web

import (
	"net/http"
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
