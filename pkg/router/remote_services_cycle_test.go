package router

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// remoteServicesProxy is a router serving group from an ST pod's remote
// services, as newRemoteServicesLoader wires them: the headers, then the
// signer, inside the aggregate proxy's tracing transport.
func remoteServicesProxy(t *testing.T, group string, exchanger *recordingExchanger, remote http.RoundTripper) *GrafanaRouter {
	t.Helper()
	base, err := url.Parse("https://mt.invalid")
	require.NoError(t, err)
	transport := newRemoteServiceHeaders("stacks-1")(newRemoteServiceSigner(exchanger, "stacks-1", defaultRemoteServicesAudience)(remote))
	backend, err := newAggregateBackend("remote_mt", metav1.APIGroup{
		Name:     group,
		Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: group + "/v1", Version: "v1"}},
	}, base, transport)
	require.NoError(t, err)
	router := NewGrafanaRouter(&mutableLoader{backends: []Backend{backend}}, nil)
	require.NoError(t, router.reconcile(t.Context()))
	return router
}

// The MT service gets the stack's origin, and the outbound span's traceparent
// in Grafana-Upstream-Traceparent too.
func TestRemoteServiceHeaders(t *testing.T) {
	previous := otel.GetTextMapPropagator()
	otel.SetTextMapPropagator(propagation.TraceContext{})
	t.Cleanup(func() { otel.SetTextMapPropagator(previous) })

	const group = "folder.grafana.app"
	var got http.Header
	router := remoteServicesProxy(t, group, &recordingExchanger{}, fallbackRoundTripper(func(r *http.Request) (*http.Response, error) {
		got = r.Header
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: http.NoBody, Request: r}, nil
	}))

	traceID := trace.TraceID{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}
	caller := trace.NewSpanContext(trace.SpanContextConfig{TraceID: traceID, SpanID: trace.SpanID{1}, TraceFlags: trace.FlagsSampled})
	req := newRequestAs(http.MethodGet, "/apis/"+group+"/v1/namespaces/stacks-1/folders", &identity.StaticRequester{
		Type: types.TypeUser, UserUID: "u", OrgID: 1, Namespace: "stacks-1", IDToken: "id",
	})
	req = req.WithContext(trace.ContextWithRemoteSpanContext(req.Context(), caller))
	rec := httptest.NewRecorder()
	router.HandleFunc(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "stacks-1", got.Get(remoteServicesOriginHeader))
	require.NotEmpty(t, got.Get("traceparent"))
	require.Equal(t, got.Get("traceparent"), got.Get(upstreamTraceHeader))
	require.Contains(t, got.Get(upstreamTraceHeader), traceID.String())
	require.Empty(t, req.Header.Get(remoteServicesOriginHeader), "the caller's request must not be modified")
}

// Step 3 of the cycle, at an ST pod whose MT router lacks the fallback check:
// a request that already left a stack's remote services and came back is
// refused, without a token exchange, the backend, or the breaker.
func TestRemoteServicesRefuseAReturningRequest(t *testing.T) {
	const group = "folder.grafana.app"
	sent := 0
	exchanger := &recordingExchanger{}
	router := remoteServicesProxy(t, group, exchanger, fallbackRoundTripper(func(r *http.Request) (*http.Response, error) {
		sent++
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: http.NoBody, Request: r}, nil
	}))

	req := newRequestAs(http.MethodGet, "/apis/"+group+"/v1/namespaces/stacks-1/folders", &identity.StaticRequester{
		Type: types.TypeUser, UserUID: "u", OrgID: 1, Namespace: "stacks-1", IDToken: "id",
	})
	req.Header.Set(remoteServicesOriginHeader, "stacks-1")
	rec := httptest.NewRecorder()
	router.HandleFunc(rec, req)

	require.Equal(t, http.StatusLoopDetected, rec.Code)
	var status metav1.Status
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &status))
	require.EqualValues(t, http.StatusLoopDetected, status.Code)
	require.Zero(t, sent)
	require.Empty(t, exchanger.reqs)
	counts := router.served[group].breaker.Counts()
	require.Zero(t, counts.TotalFailures)
	require.Zero(t, counts.TotalSuccesses)
}

// The MT router's fallback never sends a stack's remote services request back
// to an ST pod: it answers 508 before looking the stack up.
func TestSingleTenantFallbackRefusesRemoteServicesRequests(t *testing.T) {
	lookups := 0
	st, err := newSingleTenantFallback(singleTenantFallbackOptions{
		cacheSize: 10,
		resolveHost: func(context.Context, int64) (singleTenantStack, error) {
			lookups++
			return singleTenantStack{}, nil
		},
	})
	require.NoError(t, err)

	for _, path := range []string{
		"/apis/folder.grafana.app/v1/namespaces/stacks-1/folders",
		"/apis/iam.grafana.app/v0alpha1/display",
		"/apis/folder.grafana.app/v1",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set(remoteServicesOriginHeader, "stacks-1")
		outcome := &requestOutcome{}
		req = req.WithContext(context.WithValue(req.Context(), requestOutcomeKey{}, outcome))
		rec := httptest.NewRecorder()
		st.ServeHTTP(rec, req)

		require.Equal(t, http.StatusLoopDetected, rec.Code, path)
		require.Equal(t, failureLoop, outcome.failure, path)
	}
	require.Zero(t, lookups)

	// Without the header, the fallback looks the stack up as usual.
	rec := httptest.NewRecorder()
	st.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/apis/folder.grafana.app/v1/namespaces/stacks-1/folders", nil))
	require.Equal(t, http.StatusNotFound, rec.Code)
	require.Equal(t, 1, lookups)
}
