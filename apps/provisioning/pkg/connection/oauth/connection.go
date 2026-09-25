package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"golang.org/x/oauth2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// Provider supplies the provider-specific pieces of an OAuth app connection
// (e.g. GitLab, Bitbucket): its OAuth application settings and API calls.
//
//go:generate mockery --name Provider --structname MockProvider --inpackage --filename provider_mock.go --with-expecter
type Provider interface {
	Endpoint() oauth2.Endpoint
	ListRepositories(ctx context.Context) ([]provisioning.ExternalRepository, error)
}

type oauthConnection struct {
	provider     Provider
	repoType     provisioning.RepositoryType
	clientID     string
	clientSecret common.RawSecureValue
	token        common.RawSecureValue
}

func newConnection(provider Provider, repoType provisioning.RepositoryType, cfg provisioning.ConnectionOAuthConfig, clientSecret, token common.RawSecureValue) *oauthConnection {
	return &oauthConnection{
		provider:     provider,
		repoType:     repoType,
		clientID:     cfg.ClientID,
		clientSecret: clientSecret,
		token:        token,
	}
}

// Test validates that the stored access token works against the provider.
func (c *oauthConnection) Test(ctx context.Context) (*provisioning.TestResults, error) {
	if token, err := parseToken(c.token); err != nil || token.AccessToken == "" {
		return connection.FailedTestResults(
			http.StatusUnauthorized,
			[]provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueRequired,
				Field:  field.NewPath("secure", "token").String(),
				Detail: "This connection has not been authorized yet",
			}},
		), nil
	}

	if _, err := c.ListRepositories(ctx); err != nil {
		if errors.Is(err, connection.ErrAuthentication) {
			return connection.FailedTestResults(
				http.StatusUnauthorized,
				[]provisioning.ErrorDetails{{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  field.NewPath("secure", "token").String(),
					Detail: "The provider rejected the connection's access token",
				}},
			), nil
		}
		return connection.FailedTestResults(
			http.StatusUnprocessableEntity,
			[]provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeInternal,
				Detail: fmt.Errorf("failed to list repositories: %w", err).Error(),
			}},
		), nil
	}

	return connection.SuccessTestResults(), nil
}

// GenerateRepositoryToken returns an access token usable for git operations on
// the given repository. OAuth app tokens are not repository scoped, so this is
// the connection-level access token kept fresh by the connection controller.
func (c *oauthConnection) GenerateRepositoryToken(_ context.Context, repo *provisioning.Repository) (*connection.ExpirableSecureValue, error) {
	if repo == nil {
		return nil, errors.New("a repository is required to generate a token")
	}
	if repo.Spec.Type != c.repoType {
		return nil, fmt.Errorf("repository type %q is not served by this connection (serves %q)", repo.Spec.Type, c.repoType)
	}

	token, err := parseToken(c.token)
	if err != nil || token.AccessToken == "" {
		return nil, fmt.Errorf("connection access token not available: %w", connection.ErrAuthentication)
	}
	if !token.Expiry.IsZero() && time.Now().After(token.Expiry) {
		return nil, fmt.Errorf("connection access token expired: %w", connection.ErrAuthentication)
	}

	return &connection.ExpirableSecureValue{
		Token:     common.RawSecureValue(token.AccessToken),
		ExpiresAt: token.Expiry,
	}, nil
}

// ListRepositories returns the list of repositories accessible through this connection.
func (c *oauthConnection) ListRepositories(ctx context.Context) ([]provisioning.ExternalRepository, error) {
	token, err := parseToken(c.token)
	if err != nil || token.AccessToken == "" {
		return nil, fmt.Errorf("connection access token not available: %w", connection.ErrAuthentication)
	}

	return c.provider.ListRepositories(ctx)
}

// GenerateConnectionToken exchanges the stored refresh token for a new access
// token via the provider's token endpoint. Providers that rotate refresh tokens
// (e.g. GitLab) return a new one, which is stored as part of the token; when
// absent the stored refresh token remains valid and is kept.
// Implements the connection.TokenConnection interface.
func (c *oauthConnection) GenerateConnectionToken(ctx context.Context) (*connection.ExpirableSecureValue, error) {
	stored, err := parseToken(c.token)
	if err != nil {
		return nil, err
	}
	if stored.RefreshToken == "" {
		return nil, fmt.Errorf("no refresh token available; authorize the OAuth application again: %w", connection.ErrAuthentication)
	}

	cfg := oauth2.Config{
		ClientID:     c.clientID,
		ClientSecret: string(c.clientSecret),
		Endpoint:     c.provider.Endpoint(),
	}

	next, err := cfg.TokenSource(ctx, &oauth2.Token{RefreshToken: stored.RefreshToken}).Token()
	if err != nil {
		// A revoked or expired authorization is user-actionable: the user must
		// re-authorize the OAuth application. Transient failures (timeouts, rate
		// limiting, 5xx, transport errors) stay unwrapped so they classify as
		// system-caused and are retried rather than surfaced as a credential fault.
		if isOAuthReauthRequired(err) {
			return nil, fmt.Errorf("refresh access token: %w: %w", connection.ErrAuthentication, err)
		}
		return nil, fmt.Errorf("refresh access token: %w", err)
	}

	if next.RefreshToken == "" {
		next.RefreshToken = stored.RefreshToken
	}

	raw, err := marshalToken(next)
	if err != nil {
		return nil, err
	}

	// next.Expiry is zero when the provider does not return an expiry, which maps
	// to a non-expiring token on the status.
	return &connection.ExpirableSecureValue{Token: raw, ExpiresAt: next.Expiry}, nil
}

// oauthReauthErrorCodes are token-endpoint `error` codes (RFC 6749 §5.2 and
// provider-specific) that mean the stored authorization or the configured client
// credentials are no longer valid and the user must act. GitHub reports these
// with a 200 status rather than 401/403, and oauth2 exposes the code either way,
// so they are matched independently of the HTTP status.
var oauthReauthErrorCodes = map[string]bool{
	"invalid_grant":                true, // RFC 6749 §5.2; GitLab: refresh token revoked/expired
	"invalid_client":               true, // RFC 6749 §5.2: client credentials rejected
	"bad_refresh_token":            true, // GitHub: refresh token incorrect or expired
	"refresh_token_expired":        true, // GitHub: refresh token expired
	"incorrect_client_credentials": true, // GitHub: client secret rotated or revoked
}

// isOAuthReauthRequired reports whether an OAuth token-refresh error means the
// stored authorization is invalid and the user must re-authorize, as opposed to
// a transient failure worth retrying. It matches the credential-rejection error
// codes above and 401/403 responses (rejected client credentials), while
// deliberately excluding retryable statuses such as 408 and 429 and all
// 5xx/transport errors. oauth2 surfaces the error code even on a 200 response
// (some providers, including GitHub, return errors that way), so the code is
// checked independently of the HTTP status.
func isOAuthReauthRequired(err error) bool {
	var retrieveErr *oauth2.RetrieveError
	if !errors.As(err, &retrieveErr) {
		return false
	}
	if oauthReauthErrorCodes[retrieveErr.ErrorCode] {
		return true
	}
	if retrieveErr.Response != nil {
		switch retrieveErr.Response.StatusCode {
		case http.StatusUnauthorized, http.StatusForbidden:
			return true
		}
	}
	return false
}

// ExchangeAuthorizationCode exchanges an OAuth authorization code for tokens.
// Implements the connection.OAuthConnection interface.
func (c *oauthConnection) ExchangeAuthorizationCode(ctx context.Context, code, redirectURI string) (*connection.ExpirableSecureValue, error) {
	if code == "" {
		return nil, errors.New("an authorization code is required")
	}

	cfg := oauth2.Config{
		ClientID:     c.clientID,
		ClientSecret: string(c.clientSecret),
		Endpoint:     c.provider.Endpoint(),
		RedirectURL:  redirectURI,
	}

	token, err := cfg.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("exchange authorization code: %w", err)
	}

	raw, err := marshalToken(token)
	if err != nil {
		return nil, err
	}

	// token.Expiry is zero when the provider issues a non-expiring access token.
	return &connection.ExpirableSecureValue{Token: raw, ExpiresAt: token.Expiry}, nil
}

// ValidateToken checks the stored token. A missing expiry means the provider
// issued a non-expiring access token (e.g. GitHub OAuth apps).
func (c *oauthConnection) ValidateToken() (expiresAt time.Time, err error) {
	token, err := parseToken(c.token)
	if err != nil {
		return time.Time{}, err
	}
	if token.AccessToken == "" {
		return time.Time{}, errors.New("stored token has no access token")
	}
	return token.Expiry, nil
}

// parseToken decodes the token stored in the connection's secure token. Unlike
// a JWT, an OAuth access token is opaque: its expiry and the refresh token
// used to mint the next one are not recoverable from the token itself, so the
// whole token is stored and both must survive controller restarts and
// refresh-token rotation. A zero Expiry means the access token does not
// expire.
func parseToken(raw common.RawSecureValue) (*oauth2.Token, error) {
	if raw.IsZero() {
		return nil, errors.New("no token available")
	}

	token := &oauth2.Token{}
	if err := json.Unmarshal([]byte(raw), token); err != nil {
		return nil, errors.New("stored token is not a valid token payload")
	}

	return token, nil
}

// marshalToken encodes a token for storage in the connection's secure token.
func marshalToken(token *oauth2.Token) (common.RawSecureValue, error) {
	b, err := json.Marshal(token) // #nosec G117 -- intentional serialization into a secure value for the secret store
	if err != nil {
		return "", err
	}
	return common.RawSecureValue(b), nil
}

var (
	_ connection.Connection      = (*oauthConnection)(nil)
	_ connection.TokenConnection = (*oauthConnection)(nil)
	_ connection.OAuthConnection = (*oauthConnection)(nil)
)
