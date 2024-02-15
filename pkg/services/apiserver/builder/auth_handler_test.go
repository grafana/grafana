package builder

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestAuthHandler(t *testing.T) {
	t.Run("should not set user and group headers when user is not available", func(t *testing.T) {
		h := &mockHandler{}
		a := newAuthHandler(h)
		req, err := http.NewRequest("GET", "http://localhost:3000/apis", nil)
		require.NoError(t, err)
		a.ServeHTTP(nil, req)
		require.Empty(t, h.headers.Get("X-Remote-User"))
		require.Empty(t, h.headers.Get("X-Remote-Group"))
		require.Empty(t, h.headers.Get("X-Remote-Extra-ID-Token"))
	})

	t.Run("should set user and group headers", func(t *testing.T) {
		h := &mockHandler{
			headers: http.Header{},
		}
		a := newAuthHandler(h)
		u := &user.SignedInUser{
			UserID: 1,
			Teams:  []int64{1, 2},
		}
		ctx := appcontext.WithUser(context.Background(), u)
		req, err := http.NewRequest("GET", "http://localhost:3000/apis", nil)
		require.NoError(t, err)
		req = req.WithContext(ctx)
		a.ServeHTTP(nil, req)
		require.Equal(t, "1", h.headers.Get("X-Remote-User"))
		require.Equal(t, []string{"1", "2"}, h.headers.Values("X-Remote-Group"))
		require.Empty(t, h.headers.Get("X-Remote-Extra-ID-Token"))
	})

	t.Run("should set ID token when available", func(t *testing.T) {
		h := &mockHandler{
			headers: http.Header{},
		}
		a := newAuthHandler(h)
		u := &user.SignedInUser{
			UserID:  1,
			Teams:   []int64{1, 2},
			IDToken: "test-id-token",
		}
		ctx := appcontext.WithUser(context.Background(), u)
		req, err := http.NewRequest("GET", "http://localhost:3000/apis", nil)
		require.NoError(t, err)
		req = req.WithContext(ctx)
		a.ServeHTTP(nil, req)
		require.Equal(t, "1", h.headers.Get("X-Remote-User"))
		require.Equal(t, []string{"1", "2"}, h.headers.Values("X-Remote-Group"))
		require.Equal(t, "test-id-token", h.headers.Get("X-Remote-Extra-ID-Token"))
	})
}

type mockHandler struct {
	headers http.Header
}

func (m *mockHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	m.headers = r.Header
}
