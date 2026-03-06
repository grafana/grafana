package identity

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
)

func TestResolveUpstreamCaller(t *testing.T) {
	t.Run("preserves inbound caller (chain preservation)", func(t *testing.T) {
		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{authServiceIdentityKey: {"service-b"}},
		})
		got := ResolveUpstreamCaller(ctx, "service-a")
		require.Equal(t, "service-a", got)
	})

	t.Run("falls back to auth info when no inbound caller", func(t *testing.T) {
		ctx := types.WithAuthInfo(t.Context(), &fakeAuthInfo{
			extra: map[string][]string{authServiceIdentityKey: {"service-a"}},
		})
		got := ResolveUpstreamCaller(ctx, "")
		require.Equal(t, "service-a", got)
	})

	t.Run("returns empty when no auth info and no inbound", func(t *testing.T) {
		got := ResolveUpstreamCaller(t.Context(), "")
		require.Equal(t, "", got)
	})
}

func TestHTTPMiddleware(t *testing.T) {
	t.Run("extracts from header", func(t *testing.T) {
		var got string
		handler := HTTPMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			got = UpstreamCallerFromContext(r.Context())
		}))
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set(MetadataKeyUpstreamCaller, "service-a")
		handler.ServeHTTP(httptest.NewRecorder(), req)
		require.Equal(t, "service-a", got)
	})

	t.Run("falls back to auth info", func(t *testing.T) {
		var got string
		handler := HTTPMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			got = UpstreamCallerFromContext(r.Context())
		}))
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		ctx := types.WithAuthInfo(req.Context(), &fakeAuthInfo{
			extra: map[string][]string{authServiceIdentityKey: {"service-a"}},
		})
		req = req.WithContext(ctx)
		handler.ServeHTTP(httptest.NewRecorder(), req)
		require.Equal(t, "service-a", got)
	})

	t.Run("no-op when no header and no auth info", func(t *testing.T) {
		var got string
		handler := HTTPMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			got = UpstreamCallerFromContext(r.Context())
		}))
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		handler.ServeHTTP(httptest.NewRecorder(), req)
		require.Equal(t, "", got)
	})
}

type fakeAuthInfo struct {
	types.AuthInfo
	extra map[string][]string
}

func (f *fakeAuthInfo) GetExtra() map[string][]string { return f.extra }
