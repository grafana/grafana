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

func TestProxyDropsCallerIdentityHeaders(t *testing.T) {
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

	asserted := []string{"X-Remote-User", "X-Remote-Group", "X-Remote-Extra-Scopes", "x-remote-extra-lower", "X-WEBAUTH-USER", "X-Webauth-Email"}
	scoped := []string{"Impersonate-User", "Impersonate-Group", "Impersonate-Uid", "Impersonate-Extra-Scopes", "X-Grafana-Org-Id"}
	for name, backend := range map[string]Backend{"forward": forward, "aggregate": aggregate} {
		handler, err := backend.Load(t.Context())
		require.NoError(t, err)
		send := func(t *testing.T, ctx context.Context) http.Header {
			t.Helper()
			req := httptest.NewRequest(http.MethodGet, "/apis/test-app/v1/things", nil).WithContext(ctx)
			for _, header := range append(append([]string{}, asserted...), scoped...) {
				req.Header[header] = []string{"caller-value"} // as sent, not canonicalized
			}
			req.Header.Set("X-Remote-Addr", "kept")
			req.Header.Set("Accept", "application/json")
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, req)
			require.Equal(t, http.StatusNoContent, recorder.Code)
			return received
		}

		t.Run(name+": without a requester", func(t *testing.T) {
			h := send(t, t.Context())
			for _, header := range asserted {
				require.Empty(t, h.Values(header), "%s asserts an identity, which a caller must never set", header)
			}
			for _, header := range scoped {
				require.Equal(t, "caller-value", h.Get(header), "%s is authorized by the backend against the caller's own credentials", header)
			}
			require.Equal(t, "kept", h.Get("X-Remote-Addr"), "only the listed prefixes are dropped")
			require.Equal(t, "application/json", h.Get("Accept"))
		})

		t.Run(name+": with a requester", func(t *testing.T) {
			ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{AccessToken: "access"})
			h := send(t, ctx)
			for _, header := range append(append([]string{}, asserted...), scoped...) {
				require.Empty(t, h.Values(header), "%s must not ride alongside the requester's tokens", header)
			}
			require.Equal(t, "Bearer access", h.Get("Authorization"))
			require.Equal(t, "kept", h.Get("X-Remote-Addr"))
		})
	}
}

func TestDeleteHeaders(t *testing.T) {
	header := http.Header{}
	header.Set("Impersonate-User", "a")
	header["impersonate-group"] = []string{"b"}
	header.Set("Impersonated", "kept")
	header.Set("X-Grafana-Org-Id", "1")
	deleteHeaders(header, []string{"Impersonate-", "X-Grafana-Org-Id"})
	require.Equal(t, http.Header{"Impersonated": {"kept"}}, header)
}
