// Package apis calls the app platform API servers on behalf of a legacy API
// request.
package apis

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// authlib reads these headers with authn.HTTPTokenProvider, but does not
// export their names.
const (
	accessTokenHeader = "X-Access-Token"
	idTokenHeader     = "X-Grafana-Id"
)

// Credentials are the tokens edge AuthN sets on a request: an access token,
// and the ID token of the requester.
type Credentials struct {
	AccessToken string
	IDToken     string
}

func CredentialsFromRequest(r *http.Request) Credentials {
	tokens := authn.NewHTTPTokenProvider(r)
	accessToken, _ := tokens.AccessToken(r.Context())
	idToken, _ := tokens.IDToken(r.Context())
	return Credentials{AccessToken: accessToken, IDToken: idToken}
}

// Requester is the identity an ID token describes.
type Requester struct {
	Namespace  string
	Type       types.IdentityType
	Identifier string
}

var idTokenParser = authn.NewUnsafeIDTokenVerifier(authn.VerifierConfig{})

// ParseIDToken reads the requester from an ID token. It checks the token's
// expiry but not its signature. The API servers verify the token on every
// request this service makes with it.
func ParseIDToken(ctx context.Context, token string) (Requester, error) {
	claims, err := idTokenParser.Verify(ctx, token)
	if err != nil {
		return Requester{}, err
	}
	return Requester{
		Namespace:  claims.Rest.Namespace,
		Type:       claims.Rest.Type,
		Identifier: claims.Rest.Identifier,
	}, nil
}

// StatusError is a response from an API server with a status other than 200.
type StatusError struct {
	Code int
	Body string
}

func (e *StatusError) Error() string {
	return fmt.Sprintf("API server returned %d: %s", e.Code, e.Body)
}

// StatusCode returns the API server's status for err, or 0 when err is not
// a StatusError.
func StatusCode(err error) int {
	var statusErr *StatusError
	if errors.As(err, &statusErr) {
		return statusErr.Code
	}
	return 0
}

// Client gets resources from one API server.
type Client struct {
	baseURL string
	http    *http.Client
}

func NewClient(baseURL string, httpClient *http.Client) *Client {
	return &Client{baseURL: strings.TrimSuffix(baseURL, "/"), http: httpClient}
}

// Get fetches the resource at path with creds.
func (c *Client) Get(ctx context.Context, path string, creds Credentials) (*unstructured.Unstructured, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if creds.AccessToken != "" {
		req.Header.Set(accessTokenHeader, creds.AccessToken)
	}
	if creds.IDToken != "" {
		req.Header.Set(idTokenHeader, creds.IDToken)
	}

	rsp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rsp.Body.Close() }()

	body, err := io.ReadAll(rsp.Body)
	if err != nil {
		return nil, err
	}
	if rsp.StatusCode != http.StatusOK {
		return nil, &StatusError{Code: rsp.StatusCode, Body: string(body)}
	}

	obj := &unstructured.Unstructured{}
	if err := obj.UnmarshalJSON(body); err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	return obj, nil
}
