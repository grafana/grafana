package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestProxyOutboundCredentials(t *testing.T) {
	var received http.Header
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received = r.Header.Clone()
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(upstream.Close)
	upstreamURL, err := url.Parse(upstream.URL)
	require.NoError(t, err)

	group := metav1.APIGroup{Name: "test-app"}
	forward, err := NewForwardBackend(group, forwardSpec(upstream.URL), "1", &http.Transport{})
	require.NoError(t, err)
	aggregate, err := newAggregateBackend("target", group, upstreamURL, &http.Transport{})
	require.NoError(t, err)

	for name, backend := range map[string]Backend{"forward": forward, "aggregate": aggregate} {
		handler, err := backend.Load(t.Context())
		require.NoError(t, err)
		send := func(t *testing.T, ctx context.Context) http.Header {
			t.Helper()
			req := httptest.NewRequest(http.MethodGet, "/apis/test-app/v1/things", nil).WithContext(ctx)
			req.RemoteAddr = "203.0.113.7:1234"
			req.Header.Set("Cookie", "grafana_session=secret")
			req.Header.Set("Authorization", "Basic c2VjcmV0")
			req.Header.Set("X-Access-Token", "caller-access-token")
			req.Header.Set("X-Grafana-Id", "caller-id-token")
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)
			require.Equal(t, http.StatusNoContent, recorder.Code)
			return received
		}

		t.Run(name+": without a requester, caller credentials pass through", func(t *testing.T) {
			h := send(t, t.Context())
			require.Equal(t, "grafana_session=secret", h.Get("Cookie"))
			require.Equal(t, "Basic c2VjcmV0", h.Get("Authorization"))
			require.Equal(t, "caller-access-token", h.Get("X-Access-Token"))
			require.Equal(t, "caller-id-token", h.Get("X-Grafana-Id"))
			require.Equal(t, "203.0.113.7", h.Get("X-Forwarded-For"))
		})

		t.Run(name+": an authenticated requester replaces caller credentials", func(t *testing.T) {
			ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{AccessToken: "access", IDToken: "id"})
			h := send(t, ctx)
			require.Empty(t, h.Values("Cookie"))
			require.Equal(t, "Bearer access", h.Get("Authorization"))
			require.Equal(t, "Bearer access", h.Get("X-Access-Token"))
			require.Equal(t, "id", h.Get("X-Grafana-Id"))
			require.Equal(t, "203.0.113.7", h.Get("X-Forwarded-For"))
		})

		t.Run(name+": a requester without tokens sends no credentials", func(t *testing.T) {
			ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{})
			h := send(t, ctx)
			for _, header := range callerCredentialHeaders {
				require.Empty(t, h.Values(header), header)
			}
		})
	}
}
