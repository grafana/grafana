package oauth2

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type mockTokenFetcher struct{ token *Token }

func (f *mockTokenFetcher) Fn() func(*Token) (*Token, error) {
	return func(*Token) (*Token, error) {
		return f.token, nil
	}
}

func TestInitialTokenRead(t *testing.T) {
	tr := newTransport(http.DefaultTransport, nil, &Token{AccessToken: "abc"})
	server := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer abc" {
			t.Errorf("Transport doesn't set the Authorization header from the initial token")
		}
	})
	defer server.Close()
	client := http.Client{Transport: tr}
	client.Get(server.URL)
}

func TestTokenFetch(t *testing.T) {
	fetcher := &mockTokenFetcher{
		token: &Token{
			AccessToken: "abc",
		},
	}
	tr := newTransport(http.DefaultTransport, &Options{TokenFetcherFunc: fetcher.Fn()}, nil)
	server := newMockServer(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer abc" {
			t.Errorf("Transport doesn't set the Authorization header from the fetched token")
		}
	})
	defer server.Close()

	client := http.Client{Transport: tr}
	client.Get(server.URL)
	if tr.Token().AccessToken != "abc" {
		t.Errorf("New token is not set, found %v", tr.Token())
	}
}

func TestExpiredWithNoAccessToken(t *testing.T) {
	token := &Token{}
	if !token.Expired() {
		t.Errorf("Token should be expired if no access token is provided")
	}
}

func TestExpiredWithExpiry(t *testing.T) {
	token := &Token{
		Expiry: time.Now().Add(-5 * time.Hour),
	}
	if !token.Expired() {
		t.Errorf("Token should be expired if no access token is provided")
	}
}

func newMockServer(handler func(w http.ResponseWriter, r *http.Request)) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(handler))
}
