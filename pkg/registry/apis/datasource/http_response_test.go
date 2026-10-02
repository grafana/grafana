package datasource

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWriteHTTPErrorAfterPartialResponse(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	w.WriteHeader(http.StatusCreated)
	_, err := w.Write([]byte("partial"))
	require.NoError(t, err)

	require.NotPanics(t, func() {
		WriteHTTPError(w, r, errors.New("request failed"))
	})
	require.Equal(t, http.StatusCreated, w.Code)
	require.Contains(t, w.Body.String(), `partial{"kind":"Status"`)
}

func TestWriteHTTPJSONEncodingFailureDoesNotPanic(t *testing.T) {
	w := httptest.NewRecorder()

	require.NotPanics(t, func() {
		WriteHTTPJSON(w, http.StatusOK, make(chan int))
	})
	require.Equal(t, http.StatusOK, w.Code)
	require.Empty(t, w.Body.String())
}

type failingHTTPWriter struct {
	*httptest.ResponseRecorder
}

func (w failingHTTPWriter) Write([]byte) (int, error) {
	return 0, errors.New("client disconnected")
}

func TestWriteHTTPJSONWriteFailureDoesNotPanic(t *testing.T) {
	w := failingHTTPWriter{httptest.NewRecorder()}

	require.NotPanics(t, func() {
		WriteHTTPJSON(w, http.StatusOK, map[string]string{"result": "ok"})
	})
}
