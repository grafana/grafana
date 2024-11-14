package httpresponsesender

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestHTTPResponseSender(t *testing.T) {
	w := httptest.NewRecorder()
	sender := New(w)
	require.NotNil(t, sender)

	headers := http.Header{}
	headers.Add("X-Custom", "custom")
	err := sender.Send(&backend.CallResourceResponse{
		Status:  http.StatusOK,
		Headers: headers,
		Body:    []byte("Hello world"),
	})
	require.NoError(t, err)

	headers2 := http.Header{}
	headers2.Add("X-Custom-Two", "custom two")
	err = sender.Send(&backend.CallResourceResponse{
		Status:  http.StatusNotFound,
		Headers: headers2,
		Body:    []byte("Hello world again"),
	})
	require.NoError(t, err)

	resp := w.Result()
	require.NotNil(t, resp)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, "custom", resp.Header.Get("X-Custom"))
	require.Empty(t, resp.Header.Get("X-Custom-Two"))
	bytes, err := io.ReadAll(resp.Body)
	require.NoError(t, resp.Body.Close())
	require.NoError(t, err)
	require.Equal(t, "Hello worldHello world again", string(bytes))
}
