package auth

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/authlib/authn"
)

type fakeExchanger struct {
	resp *authn.TokenExchangeResponse
	err  error
}

func (f *fakeExchanger) Exchange(ctx context.Context, req authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error) {
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
	}))

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example", nil)
	resp, err := tr.RoundTrip(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// drain and close body
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
}

func TestRoundTripper_PropagatesExchangeError(t *testing.T) {
	tr := NewRoundTripper(&fakeExchanger{err: io.EOF}, roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		t.Fatal("transport should not be called on exchange error")
		return nil, nil
	}))

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "http://example", nil)
	if _, err := tr.RoundTrip(req); err == nil {
		t.Fatalf("expected error, got nil")
	}
}
