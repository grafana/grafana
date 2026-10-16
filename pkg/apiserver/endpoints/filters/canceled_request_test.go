package filters

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// connResponseWriter mimics the net/http ResponseWriter implementations, which
// implement both http.CloseNotifier and http.Flusher. httptest.ResponseRecorder
// implements Flusher but not CloseNotifier, so on its own it cannot exercise
// responsewriter.WrapForHTTP1Or2's interface preservation.
type connResponseWriter struct {
	*httptest.ResponseRecorder
}

func (w *connResponseWriter) CloseNotify() <-chan bool { return make(chan bool) }

// canceledContextRequest returns a request whose context is already canceled,
// mirroring what the net/http server does when a client disconnects.
func canceledContextRequest(t *testing.T) *http.Request {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	return httptest.NewRequest(http.MethodPost, "/apis/query.grafana.app/v0alpha1/namespaces/stacks-1/query", nil).WithContext(ctx)
}

func TestWithCanceledRequestStatus(t *testing.T) {
	t.Run("rewrites 504 to 499 when the client canceled the request", func(t *testing.T) {
		rec := httptest.NewRecorder()

		WithCanceledRequestStatus(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusGatewayTimeout)
		})).ServeHTTP(rec, canceledContextRequest(t))

		require.Equal(t, statusClientClosedRequest, rec.Code)
	})

	t.Run("keeps 504 when the context was not canceled", func(t *testing.T) {
		rec := httptest.NewRecorder()

		WithCanceledRequestStatus(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusGatewayTimeout)
		})).ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/apis/query.grafana.app/v0alpha1/namespaces/stacks-1/query", nil))

		require.Equal(t, http.StatusGatewayTimeout, rec.Code)
	})

	t.Run("keeps 504 when the deadline was exceeded rather than canceled", func(t *testing.T) {
		rec := httptest.NewRecorder()

		ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
		defer cancel()
		req := httptest.NewRequest(http.MethodPost, "/apis/query.grafana.app/v0alpha1/namespaces/stacks-1/query", nil).WithContext(ctx)

		WithCanceledRequestStatus(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusGatewayTimeout)
		})).ServeHTTP(rec, req)

		require.Equal(t, http.StatusGatewayTimeout, rec.Code)
	})

	t.Run("leaves non-504 statuses untouched on a canceled request", func(t *testing.T) {
		rec := httptest.NewRecorder()

		WithCanceledRequestStatus(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})).ServeHTTP(rec, canceledContextRequest(t))

		require.Equal(t, http.StatusInternalServerError, rec.Code)
	})

	t.Run("passes the body through unchanged", func(t *testing.T) {
		rec := httptest.NewRecorder()

		WithCanceledRequestStatus(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusGatewayTimeout)
			_, _ = w.Write([]byte(`{"code":504}`))
		})).ServeHTTP(rec, canceledContextRequest(t))

		require.Equal(t, statusClientClosedRequest, rec.Code)
		require.Equal(t, `{"code":504}`, rec.Body.String())
	})

	t.Run("keeps the ResponseWriter flushable and close-notifiable for streaming handlers", func(t *testing.T) {
		rec := httptest.NewRecorder()
		inner := &connResponseWriter{ResponseRecorder: rec}
		var flushable, closeNotifiable bool

		WithCanceledRequestStatus(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, flushable = w.(http.Flusher)
			_, closeNotifiable = w.(http.CloseNotifier)
			w.WriteHeader(http.StatusGatewayTimeout)
		})).ServeHTTP(inner, canceledContextRequest(t))

		require.True(t, flushable, "wrapped ResponseWriter must still implement http.Flusher")
		require.True(t, closeNotifiable, "wrapped ResponseWriter must still implement http.CloseNotifier")
		// The rewrite must still apply through responsewriter.WrapForHTTP1Or2.
		require.Equal(t, statusClientClosedRequest, rec.Code)
	})
}
