package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"
)

func TestOAuth2ClientCredentialsMiddleware(t *testing.T) {
	t.Run("Name should be correct", func(t *testing.T) {
		cfg := OAuth2ClientCredentialsConfig{
			ClientID:     "test-client",
			ClientSecret: "test-secret",
			TokenURL:     "http://auth.example.com/token",
		}
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK}, nil
		})
		mw := OAuth2ClientCredentials(backend.NewLoggerWith("logger", "test"), cfg)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)
		middlewareName, ok := mw.(httpclient.MiddlewareName)
		require.True(t, ok)
		require.Equal(t, oauth2ClientCredentialsMiddlewareName, middlewareName.MiddlewareName())
	})

	t.Run("Should skip middleware when client ID is empty", func(t *testing.T) {
		cfg := OAuth2ClientCredentialsConfig{
			ClientID:     "",
			ClientSecret: "test-secret",
			TokenURL:     "http://auth.example.com/token",
		}
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK}, nil
		})
		mw := OAuth2ClientCredentials(backend.NewLoggerWith("logger", "test"), cfg)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)

		req, err := http.NewRequest(http.MethodGet, "http://test.com/api/v1/query", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)
		// Should NOT have Authorization header since middleware was skipped
		require.Empty(t, req.Header.Get("Authorization"))
	})

	t.Run("Should skip middleware when token URL is empty", func(t *testing.T) {
		cfg := OAuth2ClientCredentialsConfig{
			ClientID:     "test-client",
			ClientSecret: "test-secret",
			TokenURL:     "",
		}
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK}, nil
		})
		mw := OAuth2ClientCredentials(backend.NewLoggerWith("logger", "test"), cfg)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)

		req, err := http.NewRequest(http.MethodGet, "http://test.com/api/v1/query", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Empty(t, req.Header.Get("Authorization"))
	})

	t.Run("Should add Bearer token to request", func(t *testing.T) {
		// Create a mock OAuth2 token server
		tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)
			require.Equal(t, "application/x-www-form-urlencoded", r.Header.Get("Content-Type"))

			// Verify form data credentials
			require.NoError(t, r.ParseForm())
			require.Equal(t, "test-client", r.PostForm.Get("client_id"))
			require.Equal(t, "test-secret", r.PostForm.Get("client_secret"))

			// Verify grant type
			require.Equal(t, "client_credentials", r.PostForm.Get("grant_type"))

			resp := tokenResponse{
				AccessToken: "test-access-token-123",
				TokenType:   "Bearer",
				ExpiresIn:   3600,
			}
			w.Header().Set("Content-Type", "application/json")
			err := json.NewEncoder(w).Encode(resp)
			require.NoError(t, err)
		}))
		defer tokenServer.Close()

		cfg := OAuth2ClientCredentialsConfig{
			ClientID:     "test-client",
			ClientSecret: "test-secret",
			TokenURL:     tokenServer.URL,
		}

		var capturedAuthHeader string
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			capturedAuthHeader = req.Header.Get("Authorization")
			return &http.Response{StatusCode: http.StatusOK}, nil
		})

		mw := OAuth2ClientCredentials(backend.NewLoggerWith("logger", "test"), cfg)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)

		req, err := http.NewRequest(http.MethodGet, "http://test.com/api/v1/query", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Equal(t, "Bearer test-access-token-123", capturedAuthHeader)
	})

	t.Run("Should include scopes in token request", func(t *testing.T) {
		tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.NoError(t, r.ParseForm())
			scopes := r.PostForm["scope"]
			require.Equal(t, []string{"read", "write"}, scopes)

			resp := tokenResponse{
				AccessToken: "scoped-token",
				TokenType:   "Bearer",
				ExpiresIn:   3600,
			}
			w.Header().Set("Content-Type", "application/json")
			err := json.NewEncoder(w).Encode(resp)
			require.NoError(t, err)
		}))
		defer tokenServer.Close()

		cfg := OAuth2ClientCredentialsConfig{
			ClientID:     "test-client",
			ClientSecret: "test-secret",
			TokenURL:     tokenServer.URL,
			Scopes:       []string{"read", "write"},
		}

		var capturedAuthHeader string
		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			capturedAuthHeader = req.Header.Get("Authorization")
			return &http.Response{StatusCode: http.StatusOK}, nil
		})

		mw := OAuth2ClientCredentials(backend.NewLoggerWith("logger", "test"), cfg)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)

		req, err := http.NewRequest(http.MethodGet, "http://test.com/api/v1/query", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Equal(t, "Bearer scoped-token", capturedAuthHeader)
	})

	t.Run("Should cache token and reuse it", func(t *testing.T) {
		tokenRequestCount := 0
		tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenRequestCount++
			resp := tokenResponse{
				AccessToken: "cached-token",
				TokenType:   "Bearer",
				ExpiresIn:   3600,
			}
			w.Header().Set("Content-Type", "application/json")
			err := json.NewEncoder(w).Encode(resp)
			require.NoError(t, err)
		}))
		defer tokenServer.Close()

		cfg := OAuth2ClientCredentialsConfig{
			ClientID:     "test-client",
			ClientSecret: "test-secret",
			TokenURL:     tokenServer.URL,
		}

		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK}, nil
		})

		mw := OAuth2ClientCredentials(backend.NewLoggerWith("logger", "test"), cfg)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)

		// Make two requests - should only fetch token once
		for i := 0; i < 2; i++ {
			req, err := http.NewRequest(http.MethodGet, "http://test.com/api/v1/query", nil)
			require.NoError(t, err)
			res, err := rt.RoundTrip(req)
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, res.StatusCode)
		}

		require.Equal(t, 1, tokenRequestCount, "Token should be fetched only once due to caching")
	})

	t.Run("Should return error when token server returns error", func(t *testing.T) {
		tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error": "invalid_client"}`))
		}))
		defer tokenServer.Close()

		cfg := OAuth2ClientCredentialsConfig{
			ClientID:     "bad-client",
			ClientSecret: "bad-secret",
			TokenURL:     tokenServer.URL,
		}

		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK}, nil
		})

		mw := OAuth2ClientCredentials(backend.NewLoggerWith("logger", "test"), cfg)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)

		req, err := http.NewRequest(http.MethodGet, "http://test.com/api/v1/query", nil)
		require.NoError(t, err)
		_, err = rt.RoundTrip(req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid_client")
	})

	t.Run("Should include endpoint params in token request", func(t *testing.T) {
		tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.NoError(t, r.ParseForm())
			require.Equal(t, "custom-audience", r.PostForm.Get("audience"))
			require.Equal(t, "custom-resource", r.PostForm.Get("resource"))

			resp := tokenResponse{
				AccessToken: "param-token",
				TokenType:   "Bearer",
				ExpiresIn:   3600,
			}
			w.Header().Set("Content-Type", "application/json")
			err := json.NewEncoder(w).Encode(resp)
			require.NoError(t, err)
		}))
		defer tokenServer.Close()

		cfg := OAuth2ClientCredentialsConfig{
			ClientID:     "test-client",
			ClientSecret: "test-secret",
			TokenURL:     tokenServer.URL,
			EndpointParams: map[string][]string{
				"audience": {"custom-audience"},
				"resource": {"custom-resource"},
			},
		}

		finalRoundTripper := httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: http.StatusOK}, nil
		})

		mw := OAuth2ClientCredentials(backend.NewLoggerWith("logger", "test"), cfg)
		rt := mw.CreateMiddleware(httpclient.Options{}, finalRoundTripper)
		require.NotNil(t, rt)

		req, err := http.NewRequest(http.MethodGet, "http://test.com/api/v1/query", nil)
		require.NoError(t, err)
		res, err := rt.RoundTrip(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)
	})
}

func TestParseTokenResponse(t *testing.T) {
	t.Run("Should parse valid token response", func(t *testing.T) {
		body := `{"access_token": "test-token", "token_type": "Bearer", "expires_in": 3600}`
		resp := &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(body)),
		}

		token, expiry, err := parseTokenResponse(resp)
		require.NoError(t, err)
		require.Equal(t, "test-token", token)
		require.True(t, expiry.After(time.Now()))
	})

	t.Run("Should return error for non-200 status", func(t *testing.T) {
		resp := &http.Response{
			StatusCode: http.StatusBadRequest,
			Body:       io.NopCloser(strings.NewReader(`{"error": "invalid_request"}`)),
		}

		_, _, err := parseTokenResponse(resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "400")
	})

	t.Run("Should return error for missing access token", func(t *testing.T) {
		resp := &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(`{"token_type": "Bearer", "expires_in": 3600}`)),
		}

		_, _, err := parseTokenResponse(resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing access_token")
	})
}

