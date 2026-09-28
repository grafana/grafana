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
