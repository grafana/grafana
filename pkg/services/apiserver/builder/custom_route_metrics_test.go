package builder

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

// Streaming handlers, such as plugin routes, must be able to flush through the
// metrics wrapper.
func TestInstrumentHandler_Flush(t *testing.T) {
	recorder := httptest.NewRecorder()
	handler := NewCustomRouteMetrics(nil).InstrumentHandler("test.grafana.app", "v1", "stream", func(w http.ResponseWriter, _ *http.Request) {
		flusher, ok := w.(http.Flusher)
		require.True(t, ok, "wrapped writer does not implement http.Flusher")
		flusher.Flush()
	})

	handler(recorder, httptest.NewRequest(http.MethodGet, "/apis/test.grafana.app/v1/stream", nil))

	require.True(t, recorder.Flushed)
}

func TestInstrumentHandler_ResponseController(t *testing.T) {
	recorder := httptest.NewRecorder()
	handler := NewCustomRouteMetrics(nil).InstrumentHandler("test.grafana.app", "v1", "stream", func(w http.ResponseWriter, _ *http.Request) {
		require.NoError(t, http.NewResponseController(w).Flush())
	})

	handler(recorder, httptest.NewRequest(http.MethodGet, "/apis/test.grafana.app/v1/stream", nil))

	require.True(t, recorder.Flushed)
}

func TestResponseWriterWithStatus(t *testing.T) {
	for _, tc := range []struct {
		name  string
		write func(*ResponseWriterWithStatus)
		want  int
	}{
		{"empty", func(*ResponseWriterWithStatus) {}, http.StatusOK},
		{"interim then final", func(w *ResponseWriterWithStatus) {
			w.WriteHeader(http.StatusEarlyHints)
			w.WriteHeader(http.StatusBadGateway)
			w.WriteHeader(http.StatusOK)
		}, http.StatusBadGateway},
		{"protocol upgrade", func(w *ResponseWriterWithStatus) { w.WriteHeader(http.StatusSwitchingProtocols) }, http.StatusSwitchingProtocols},
		{"body commits status", func(w *ResponseWriterWithStatus) {
			_, _ = w.Write([]byte("ok"))
			w.WriteHeader(http.StatusBadGateway)
		}, http.StatusOK},
		{"flush commits status", func(w *ResponseWriterWithStatus) {
			w.Flush()
			w.WriteHeader(http.StatusBadGateway)
		}, http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := NewResponseWriterWithStatus(httptest.NewRecorder())
			tc.write(w)
			require.Equal(t, tc.want, w.StatusCode())
		})
	}
}
