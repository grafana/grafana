package filters

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/apiserver/endpoints/request"
	"github.com/stretchr/testify/require"
)

func TestWithAcceptHeader(t *testing.T) {
	t.Run("should not set accept header in context for empty header", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)

		rr := httptest.NewRecorder()
		handler := &fakeHandler{}
		WithAcceptHeader(handler).ServeHTTP(rr, req)

		acceptHeader, ok := request.AcceptHeaderFrom(handler.ctx)
		require.False(t, ok)
		require.Empty(t, acceptHeader)
	})

	t.Run("should set accept header in context", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Accept", "application/json")

		rr := httptest.NewRecorder()
		handler := &fakeHandler{}
		WithAcceptHeader(handler).ServeHTTP(rr, req)

		acceptHeader, ok := request.AcceptHeaderFrom(handler.ctx)
		require.True(t, ok)
		require.Equal(t, "application/json", acceptHeader)
	})
}

type fakeHandler struct {
	ctx context.Context
}

func (h *fakeHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	h.ctx = req.Context()
}
