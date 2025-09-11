package auth

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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

func TestRoundTripper_SetsAccessTokenHeader(t *testing.T) {
	tr := NewRoundTripper(&fakeExchanger{resp: &authn.TokenExchangeResponse{Token: "abc123"}}, roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		got := r.Header.Get("X-Access-Token")
		if got != "Bearer abc123" {
			t.Fatalf("expected X-Access-Token header 'Bearer abc123', got %q", got)
		}
		// Return a minimal response; body must be non-nil per http.RoundTripper contract
		rr := httptest.NewRecorder()
		rr.WriteHeader(http.StatusOK)
		return rr.Result(), nil
	}), "example-audience")

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example", nil)
	resp, err := tr.RoundTrip(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// drain and close body
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
}

func TestRoundTripper_PropagatesExchangeError(t *testing.T) {
	tr := NewRoundTripper(&fakeExchanger{err: io.EOF}, roundTripperFunc(func(_ *http.Request) (*http.Response, error) {
		t.Fatal("transport should not be called on exchange error")
		return nil, nil
	}), "example-audience")

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example", nil)
	resp, err := tr.RoundTrip(req)
	if err == nil {
		if resp != nil && resp.Body != nil {
			_ = resp.Body.Close()
		}
		t.Fatalf("expected error, got nil")
	}
}

func TestRoundTripper_AudiencesAndNamespace(t *testing.T) {
	tests := []struct {
		name          string
		audience      string
		wantAudiences []string
	}{
		{
			name:          "adds group when custom audience",
			audience:      "example-audience",
			wantAudiences: []string{"example-audience", v0alpha1.GROUP},
		},
		{
			name:          "no duplicate when group audience",
			audience:      v0alpha1.GROUP,
			wantAudiences: []string{v0alpha1.GROUP},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fx := &fakeExchanger{resp: &authn.TokenExchangeResponse{Token: "abc123"}}
			tr := NewRoundTripper(fx, roundTripperFunc(func(_ *http.Request) (*http.Response, error) {
				rr := httptest.NewRecorder()
				rr.WriteHeader(http.StatusOK)
				return rr.Result(), nil
			}), tt.audience)

			req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example", nil)
			resp, err := tr.RoundTrip(req)
			require.NoError(t, err)
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
			require.NotNil(t, fx.gotReq)
			require.True(t, reflect.DeepEqual(fx.gotReq.Audiences, tt.wantAudiences))
		})
	}
}
