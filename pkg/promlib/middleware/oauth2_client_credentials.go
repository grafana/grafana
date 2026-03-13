package middleware

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

const (
	oauth2ClientCredentialsMiddlewareName = "prom-oauth2-client-credentials"
	oauth2ClientIDKey                     = "oauth2ClientId"
	oauth2ClientSecretKey                 = "oauth2ClientSecret"
	oauth2TokenURLKey                     = "oauth2TokenUrl"
	oauth2ScopesKey                       = "oauth2Scopes"
	oauth2EndpointParamsKey               = "oauth2EndpointParams"
)

// OAuth2ClientCredentialsConfig holds configuration for the OAuth2 client credentials flow.
type OAuth2ClientCredentialsConfig struct {
	ClientID       string
	ClientSecret   string
	TokenURL       string
	Scopes         []string
	EndpointParams map[string][]string
}

// OAuth2ClientCredentials creates a middleware that handles OAuth2 client credentials
// token acquisition and injection into outgoing HTTP requests.
func OAuth2ClientCredentials(logger log.Logger, cfg OAuth2ClientCredentialsConfig) sdkhttpclient.Middleware {
	return sdkhttpclient.NamedMiddlewareFunc(oauth2ClientCredentialsMiddlewareName, func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		if cfg.ClientID == "" || cfg.ClientSecret == "" || cfg.TokenURL == "" {
			logger.Warn("OAuth2 client credentials middleware: missing required configuration, skipping")
			return next
		}

		tp := &oauth2TokenProvider{
			clientID:       cfg.ClientID,
			clientSecret:   cfg.ClientSecret,
			tokenURL:       cfg.TokenURL,
			scopes:         cfg.Scopes,
			endpointParams: cfg.EndpointParams,
			httpClient:     &http.Client{Timeout: 10 * time.Second},
			logger:         logger,
		}

		return sdkhttpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			token, err := tp.getAccessToken(req.Context())
			if err != nil {
				logger.Error("OAuth2 client credentials: failed to obtain access token", "error", err)
				return nil, err
			}

			// Clone the request to avoid mutating the original
			reqClone := req.Clone(req.Context())
			reqClone.Header.Set("Authorization", "Bearer "+token)
			return next.RoundTrip(reqClone)
		})
	})
}

// oauth2TokenProvider handles token acquisition and caching for the OAuth2 client credentials flow.
type oauth2TokenProvider struct {
	clientID       string
	clientSecret   string
	tokenURL       string
	scopes         []string
	endpointParams map[string][]string
	httpClient     *http.Client
	logger         log.Logger

	mu          sync.Mutex
	cachedToken string
	expiry      time.Time
}

// getAccessToken returns a valid access token, refreshing it if necessary.
func (tp *oauth2TokenProvider) getAccessToken(ctx context.Context) (string, error) {
	tp.mu.Lock()
	defer tp.mu.Unlock()

	// Use cached token if it's still valid (with a 30-second buffer)
	if tp.cachedToken != "" && time.Now().Add(30*time.Second).Before(tp.expiry) {
		return tp.cachedToken, nil
	}

	token, expiry, err := tp.requestToken(ctx)
	if err != nil {
		return "", err
	}

	tp.cachedToken = token
	tp.expiry = expiry
	return token, nil
}

// requestToken performs the actual OAuth2 client credentials token request.
func (tp *oauth2TokenProvider) requestToken(ctx context.Context) (string, time.Time, error) {
	data := make(map[string][]string)
	data["grant_type"] = []string{"client_credentials"}
	data["client_id"] = []string{tp.clientID}
	data["client_secret"] = []string{tp.clientSecret}

	if len(tp.scopes) > 0 {
		data["scope"] = tp.scopes
	}

	for k, v := range tp.endpointParams {
		data[k] = v
	}

	body := encodeValues(data)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tp.tokenURL, strings.NewReader(body))
	if err != nil {
		return "", time.Time{}, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := tp.httpClient.Do(req)
	if err != nil {
		return "", time.Time{}, err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			tp.logger.Warn("OAuth2 client credentials: failed to close response body", "error", err)
		}
	}()

	return parseTokenResponse(resp)
}
