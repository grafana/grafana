package router

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestCanonicalAPIPath(t *testing.T) {
	for target, want := range map[string]bool{
		"/apis":                           true,
		"/apis/":                          true,
		"/apis/g/v1/":                     true,
		"/apis/g/v1/namespaces/ns/things": true,
		"/apis/g/v1/namespaces/ns/things?watch=1": true,
		"/openapi/v3/apis/g/v1?hash=abc":          true,
		"/apis/g/v1/namespaces/ns/things/a%20b":   true,
		"/apis//v1/things":                        false,
		"/apis/g/./v1/things":                     false,
		"/apis/g/../other/v1/things":              false,
		"/apis/g/v1/..":                           false,
		"/apis/g%2Fother/v1/things":               false,
		"/apis/g%2fother/v1/things":               false,
		"/openapi/v3/apis/g/../other/v1":          false,
	} {
		require.Equal(t, want, canonicalAPIPath(httptest.NewRequest(http.MethodGet, target, nil).URL), target)
	}
}

func TestHandleFuncRejectsNonCanonicalPaths(t *testing.T) {
	var calls atomic.Int32
	router := withGroupHandler("g", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
	}))
	for _, target := range []string{"/apis/g/../other/v1/things", "/apis/g%2Fother/v1/things", "/openapi/v3/apis/g/./v1"} {
		recorder := httptest.NewRecorder()
		router.HandleFunc(recorder, httptest.NewRequest(http.MethodGet, target, nil), http.NotFoundHandler())
		require.Equal(t, http.StatusBadRequest, recorder.Code, target)
	}
	require.Zero(t, calls.Load())
}

// proxiedRouter serves group "test-app" through a real forward proxy to upstream.
func proxiedRouter(t *testing.T, upstream string, transport *http.Transport) *GrafanaRouter {
	t.Helper()
	backend, err := NewForwardBackend(metav1.APIGroup{Name: "test-app"}, forwardSpec(upstream), "1", transport)
	require.NoError(t, err)
	handler, err := backend.Load(t.Context())
	require.NoError(t, err)
	return withGroupHandler("test-app", handler)
}

func serveRouter(router *GrafanaRouter, target string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	router.HandleFunc(recorder, httptest.NewRequest(http.MethodGet, target, nil), http.NotFoundHandler())
	return recorder
}

func TestRejectedRedirectsDoNotTripTheBreaker(t *testing.T) {
	var redirect atomic.Bool
	redirect.Store(true)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if redirect.Load() {
			http.Redirect(w, req, "https://elsewhere.example.com", http.StatusFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(upstream.Close)
	router := proxiedRouter(t, upstream.URL, &http.Transport{})

	for range 10 {
		recorder := serveRouter(router, "/apis/test-app/v1/things")
		require.Equal(t, http.StatusBadGateway, recorder.Code)
		require.Empty(t, recorder.Header().Get("Location"))
	}
	redirect.Store(false)
	require.Equal(t, http.StatusNoContent, serveRouter(router, "/apis/test-app/v1/things").Code, "the breaker must stay closed")
}

func TestTransportFailuresTripTheBreaker(t *testing.T) {
	upstream := httptest.NewServer(http.NotFoundHandler())
	upstream.Close()
	router := proxiedRouter(t, upstream.URL, &http.Transport{})

	for range 6 {
		require.Equal(t, http.StatusBadGateway, serveRouter(router, "/apis/test-app/v1/things").Code)
	}
	require.Equal(t, http.StatusServiceUnavailable, serveRouter(router, "/apis/test-app/v1/things").Code)
}

func TestResponseHeaderTimeout(t *testing.T) {
	const timeout = 50 * time.Millisecond
	release := make(chan struct{})
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Query().Get("watch") == "" {
			// Never answers until the test ends.
			select {
			case <-release:
			case <-req.Context().Done():
			}
			return
		}
		// A watch: headers at once, then events for longer than the header timeout.
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"type":"ADDED"}`+"\n")
		w.(http.Flusher).Flush()
		time.Sleep(4 * timeout)
		_, _ = io.WriteString(w, `{"type":"MODIFIED"}`+"\n")
	}))
	t.Cleanup(func() { close(release); upstream.Close() })
	router := proxiedRouter(t, upstream.URL, &http.Transport{ResponseHeaderTimeout: timeout})

	t.Run("a backend that never answers times out and counts", func(t *testing.T) {
		for range 6 {
			require.Equal(t, http.StatusGatewayTimeout, serveRouter(router, "/apis/test-app/v1/things").Code)
		}
		require.Equal(t, http.StatusServiceUnavailable, serveRouter(router, "/apis/test-app/v1/things").Code)
	})

	t.Run("a watch streams past the header timeout", func(t *testing.T) {
		router := proxiedRouter(t, upstream.URL, &http.Transport{ResponseHeaderTimeout: timeout})
		recorder := serveRouter(router, "/apis/test-app/v1/namespaces/ns/things?watch=1")
		require.Equal(t, http.StatusOK, recorder.Code)
		require.Equal(t, `{"type":"ADDED"}`+"\n"+`{"type":"MODIFIED"}`+"\n", recorder.Body.String())
	})
}

func TestProxyTransportsHaveAResponseHeaderTimeout(t *testing.T) {
	loader := &cloudLoader{transports: map[tlsCacheKey]*http.Transport{}}
	forward, err := loader.transportFor(tlsCacheKey{})
	require.NoError(t, err)
	st, err := newSingleTenantFallback(singleTenantFallbackOptions{
		cacheSize:   1,
		resolveHost: func(context.Context, int64) (singleTenantStack, error) { return singleTenantStack{}, nil },
	})
	require.NoError(t, err)
	for name, transport := range map[string]*http.Transport{
		"forward":            forward,
		"aggregate":          newAggregateBaseTransport(nil),
		"single-tenant (ST)": st.transport,
	} {
		require.Equal(t, backendResponseHeaderTimeout, transport.ResponseHeaderTimeout, name)
	}
}
