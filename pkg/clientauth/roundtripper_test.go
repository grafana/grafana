package clientauth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"
)

type fakeExchanger struct {
	resp   *authn.TokenExchangeResponse
	err    error
	gotReq *authn.TokenExchangeRequest
}

func (f *fakeExchanger) Exchange(_ context.Context, req authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error) {
	f.gotReq = &req
	return f.resp, f.err
}

// roundTripperFunc allows building a stub transport inline
type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestTokenExchangeRoundTripper_SetsAccessTokenHeader(t *testing.T) {
	exchanger := &fakeExchanger{resp: &authn.TokenExchangeResponse{Token: "test-token-123"}}

	var capturedHeader string
	transport := roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		capturedHeader = r.Header.Get("X-Access-Token")
		rr := httptest.NewRecorder()
		rr.WriteHeader(http.StatusOK)
		return rr.Result(), nil
	})

	rt := newTokenExchangeRoundTripperWithStrategies(exchanger, transport, NewStaticNamespaceProvider("test-namespace"), NewStaticAudienceProvider("test-audience"))
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example.org", nil)

	resp, err := rt.RoundTrip(req)
	require.NoError(t, err)
	if resp != nil {
		_ = resp.Body.Close()
	}

	// Clean up response
	_ = resp.Body.Close()

	require.Equal(t, "Bearer test-token-123", capturedHeader)
}

func TestTokenExchangeRoundTripper_PropagatesExchangeError(t *testing.T) {
	expectedErr := errors.New("token exchange failed")
	exchanger := &fakeExchanger{err: expectedErr}

	transport := roundTripperFunc(func(_ *http.Request) (*http.Response, error) {
		t.Fatal("transport should not be called on exchange error")
		return nil, nil
	})

	rt := newTokenExchangeRoundTripperWithStrategies(exchanger, transport, NewStaticNamespaceProvider("test-namespace"), NewStaticAudienceProvider("test-audience"))
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example.org", nil)

	resp, err := rt.RoundTrip(req)
	require.Error(t, err)
	if resp != nil {
		_ = resp.Body.Close()
	}
	require.ErrorContains(t, err, "failed to exchange token")
	require.ErrorIs(t, err, expectedErr)
}

func TestTokenExchangeRoundTripper_SendsCorrectAudienceAndNamespace(t *testing.T) {
	tests := []struct {
		name              string
		audience          string
		namespace         string
		expectedAudiences []string
		expectedNamespace string
	}{
		{
			name:              "single audience with wildcard namespace",
			audience:          "folder.grafana.app",
			namespace:         "*",
			expectedAudiences: []string{"folder.grafana.app"},
			expectedNamespace: "*",
		},
		{
			name:              "different audience with wildcard namespace",
			audience:          "dashboard.grafana.app",
			namespace:         "*",
			expectedAudiences: []string{"dashboard.grafana.app"},
			expectedNamespace: "*",
		},
		{
			name:              "audience with specific namespace",
			audience:          "test-audience",
			namespace:         "test-namespace",
			expectedAudiences: []string{"test-audience"},
			expectedNamespace: "test-namespace",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exchanger := &fakeExchanger{resp: &authn.TokenExchangeResponse{Token: "token"}}
			transport := roundTripperFunc(func(_ *http.Request) (*http.Response, error) {
				rr := httptest.NewRecorder()
				rr.WriteHeader(http.StatusOK)
				return rr.Result(), nil
			})

			rt := newTokenExchangeRoundTripperWithStrategies(exchanger, transport, NewStaticNamespaceProvider(tt.namespace), NewStaticAudienceProvider(tt.audience))
			req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example.org", nil)

			resp, err := rt.RoundTrip(req)
			require.NoError(t, err)
			if resp != nil {
				_ = resp.Body.Close()
			}

			require.NotNil(t, exchanger.gotReq)
			require.Equal(t, tt.expectedAudiences, exchanger.gotReq.Audiences)
			require.Equal(t, tt.expectedNamespace, exchanger.gotReq.Namespace)
		})
	}
}

func TestTokenExchangeRoundTripper_DoesNotMutateOriginalRequest(t *testing.T) {
	exchanger := &fakeExchanger{resp: &authn.TokenExchangeResponse{Token: "token"}}
	transport := roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		rr := httptest.NewRecorder()
		rr.WriteHeader(http.StatusOK)
		return rr.Result(), nil
	})

	rt := newTokenExchangeRoundTripperWithStrategies(exchanger, transport, NewStaticNamespaceProvider("namespace"), NewStaticAudienceProvider("audience"))
	originalReq, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example.org", nil)

	// Ensure original request has no X-Access-Token header
	originalReq.Header.Set("X-Custom-Header", "original-value")
	require.Empty(t, originalReq.Header.Get("X-Access-Token"))

	resp, err := rt.RoundTrip(originalReq)
	require.NoError(t, err)
	_ = resp.Body.Close()

	// Original request should not have been mutated
	require.Empty(t, originalReq.Header.Get("X-Access-Token"))
	require.Equal(t, "original-value", originalReq.Header.Get("X-Custom-Header"))
}

func TestTokenExchangeRoundTripper_PropagatesTransportError(t *testing.T) {
	exchanger := &fakeExchanger{resp: &authn.TokenExchangeResponse{Token: "token"}}
	expectedErr := errors.New("transport error")
	transport := roundTripperFunc(func(_ *http.Request) (*http.Response, error) {
		return nil, expectedErr
	})

	rt := newTokenExchangeRoundTripperWithStrategies(exchanger, transport, NewStaticNamespaceProvider("namespace"), NewStaticAudienceProvider("audience"))
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example.org", nil)

	resp, err := rt.RoundTrip(req)
	require.Error(t, err)
	if resp != nil {
		_ = resp.Body.Close()
	}
	require.ErrorIs(t, err, expectedErr)
}

func TestNewTokenExchangeTransportWrapper(t *testing.T) {
	exchanger := &fakeExchanger{resp: &authn.TokenExchangeResponse{Token: "wrapped-token"}}

	var capturedHeader string
	baseTransport := roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		capturedHeader = r.Header.Get("X-Access-Token")
		rr := httptest.NewRecorder()
		rr.WriteHeader(http.StatusOK)
		return rr.Result(), nil
	})

	wrapper := NewStaticTokenExchangeTransportWrapper(exchanger, "test-audience", "test-namespace")
	wrappedTransport := wrapper(baseTransport)

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example.org", nil)
	resp, err := wrappedTransport.RoundTrip(req)
	require.NoError(t, err)
	_ = resp.Body.Close()

	require.Equal(t, "Bearer wrapped-token", capturedHeader)
	require.NotNil(t, exchanger.gotReq)
	require.Equal(t, []string{"test-audience"}, exchanger.gotReq.Audiences)
	require.Equal(t, "test-namespace", exchanger.gotReq.Namespace)
}

func TestTokenExchangeRoundTripperWithStrategies(t *testing.T) {
	tests := []struct {
		name              string
		namespaceProvider NamespaceProvider
		audienceProvider  AudienceProvider
		expectedNamespace string
		expectedAudiences []string
		expectedHeader    string
	}{
		{
			name:              "static providers with bearer prefix",
			namespaceProvider: NewStaticNamespaceProvider("*"),
			audienceProvider:  NewStaticAudienceProvider("folder.grafana.app"),
			expectedNamespace: "*",
			expectedAudiences: []string{"folder.grafana.app"},
			expectedHeader:    "Bearer test-token",
		},
		{
			name:              "multiple audiences",
			namespaceProvider: NewStaticNamespaceProvider("*"),
			audienceProvider:  NewStaticAudienceProvider("audience1", "audience2"),
			expectedNamespace: "*",
			expectedAudiences: []string{"audience1", "audience2"},
			expectedHeader:    "Bearer test-token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exchanger := &fakeExchanger{resp: &authn.TokenExchangeResponse{Token: "test-token"}}

			var capturedHeader string
			transport := roundTripperFunc(func(r *http.Request) (*http.Response, error) {
				capturedHeader = r.Header.Get("X-Access-Token")
				rr := httptest.NewRecorder()
				rr.WriteHeader(http.StatusOK)
				return rr.Result(), nil
			})

			rt := newTokenExchangeRoundTripperWithStrategies(
				exchanger,
				transport,
				tt.namespaceProvider,
				tt.audienceProvider,
			)

			req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example.org", nil)
			resp, err := rt.RoundTrip(req)
			require.NoError(t, err)
			if resp != nil {
				_ = resp.Body.Close()
			}

			require.Equal(t, tt.expectedHeader, capturedHeader)
			require.NotNil(t, exchanger.gotReq)
			require.Equal(t, tt.expectedAudiences, exchanger.gotReq.Audiences)
			require.Equal(t, tt.expectedNamespace, exchanger.gotReq.Namespace)
		})
	}
}
