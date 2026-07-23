package oauth

import (
	"context"
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
// (e.g. GitLab, Bitbucket). Everything else — token refresh, storage format,
// repository token generation — is shared and provider agnostic.
type Provider interface {
	Type() provisioning.ConnectionType
	// RepositoryType is the repository type this connection serves (e.g. a
	// githubOAuth connection serves github repositories).
	RepositoryType() provisioning.RepositoryType
	TokenURL() string
	ListRepositories(ctx context.Context, accessToken string) ([]provisioning.ExternalRepository, error)
}

// AppURLResolver is an optional interface providers can implement to resolve the
// management URL of the OAuth application.
type AppURLResolver interface {
	AppSettingsURL(ctx context.Context, accessToken, clientID string) string
}

type ConnectionSecrets struct {
	ClientSecret common.RawSecureValue
	Token        common.RawSecureValue
}

type Connection struct {
	obj      *provisioning.Connection
	provider Provider
	clientID string
	secrets  ConnectionSecrets
}

func NewConnection(
	obj *provisioning.Connection,
	provider Provider,
	clientID string,
	secrets ConnectionSecrets,
) Connection {
	return Connection{
		obj:      obj,
		provider: provider,
		clientID: clientID,
		secrets:  secrets,
	}
}

// Test validates that the stored access token works against the provider.
// A connection without a token has not completed authorization yet; there is
// nothing to verify against the provider, so it is not treated as a failure.
func (c *Connection) Test(ctx context.Context) (*provisioning.TestResults, error) {
	payload, err := ParseToken(c.secrets.Token)
	if err != nil || payload.AccessToken == "" {
		return connection.SuccessTestResults(), nil
	}

	if _, err := c.provider.ListRepositories(ctx, payload.AccessToken); err != nil {
		if errors.Is(err, connection.ErrAuthentication) {
			return connection.FailedTestResults(http.StatusUnauthorized, []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  field.NewPath("secure", "token").String(),
				Detail: "authentication failed. The access token was rejected by the provider",
			}}), nil
		}
		return connection.FailedTestResults(http.StatusUnprocessableEntity, []provisioning.ErrorDetails{{
			Type:   metav1.CauseTypeInternal,
			Detail: fmt.Errorf("failed to list repositories: %w", err).Error(),
		}}), nil
	}

	return connection.SuccessTestResults(), nil
}

// GenerateRepositoryToken returns an access token usable for git operations on
// the given repository. OAuth app tokens are not repository scoped, so this is
// the connection-level access token kept fresh by the connection controller.
func (c *Connection) GenerateRepositoryToken(_ context.Context, repo *provisioning.Repository) (*connection.ExpirableSecureValue, error) {
	if repo == nil {
		return nil, errors.New("a repository is required to generate a token")
	}
	if repo.Spec.Type != c.provider.RepositoryType() {
		return nil, fmt.Errorf("repository type %q does not match connection type %q", repo.Spec.Type, c.provider.Type())
	}

	payload, err := ParseToken(c.secrets.Token)
	if err != nil || payload.AccessToken == "" {
		return nil, fmt.Errorf("connection access token not available: %w", connection.ErrAuthentication)
	}
	if !payload.ExpiresAt.IsZero() && time.Now().After(payload.ExpiresAt) {
		return nil, fmt.Errorf("connection access token expired: %w", connection.ErrAuthentication)
	}

	return &connection.ExpirableSecureValue{
		Token:     common.RawSecureValue(payload.AccessToken),
		ExpiresAt: payload.ExpiresAt,
	}, nil
}

// ListRepositories returns the list of repositories accessible through this connection.
func (c *Connection) ListRepositories(ctx context.Context) ([]provisioning.ExternalRepository, error) {
	payload, err := ParseToken(c.secrets.Token)
	if err != nil || payload.AccessToken == "" {
		return nil, fmt.Errorf("connection access token not available: %w", connection.ErrAuthentication)
	}

	return c.provider.ListRepositories(ctx, payload.AccessToken)
}

// GenerateConnectionToken exchanges the stored refresh token for a new access
// token via the provider's token endpoint. Providers that rotate refresh tokens
// (e.g. GitLab) return a new one, which is persisted as part of the payload.
// Implements the connection.TokenConnection interface.
func (c *Connection) GenerateConnectionToken(ctx context.Context) (common.RawSecureValue, error) {
	payload, err := ParseToken(c.secrets.Token)
	if err != nil {
		return "", err
	}
	if payload.RefreshToken == "" {
		return "", errors.New("no refresh token available; authorize the OAuth application again")
	}

	cfg := oauth2.Config{
		ClientID:     c.clientID,
		ClientSecret: string(c.secrets.ClientSecret),
		Endpoint:     oauth2.Endpoint{TokenURL: c.provider.TokenURL()},
	}

	token, err := cfg.TokenSource(ctx, &oauth2.Token{RefreshToken: payload.RefreshToken}).Token()
	if err != nil {
		return "", fmt.Errorf("refresh access token: %w", err)
	}

	next := buildPayload(token)
	if next.RefreshToken == "" {
		next.RefreshToken = payload.RefreshToken
	}

	return next.Marshal()
}

// ExchangeAuthorizationCode exchanges an OAuth authorization code for tokens.
// Implements the connection.AuthCodeConnection interface.
func (c *Connection) ExchangeAuthorizationCode(ctx context.Context, code, redirectURI string) (common.RawSecureValue, error) {
	if code == "" {
		return "", errors.New("an authorization code is required")
	}

	cfg := oauth2.Config{
		ClientID:     c.clientID,
		ClientSecret: string(c.secrets.ClientSecret),
		Endpoint:     oauth2.Endpoint{TokenURL: c.provider.TokenURL()},
		RedirectURL:  redirectURI,
	}

	token, err := cfg.Exchange(ctx, code)
	if err != nil {
		return "", fmt.Errorf("exchange authorization code: %w", err)
	}

	return buildPayload(token).Marshal()
}

// ResolveAppURL returns the management URL for the OAuth application when the
// provider can look it up with the given token.
// Implements the connection.AppURLConnection interface.
func (c *Connection) ResolveAppURL(ctx context.Context, token common.RawSecureValue) string {
	resolver, ok := c.provider.(AppURLResolver)
	if !ok {
		return ""
	}

	payload, err := ParseToken(token)
	if err != nil || payload.AccessToken == "" {
		return ""
	}

	return resolver.AppSettingsURL(ctx, payload.AccessToken, c.clientID)
}

// TokenCreationTime returns when the underlying token has been created.
func (c *Connection) TokenCreationTime(_ context.Context) (time.Time, error) {
	payload, err := ParseToken(c.secrets.Token)
	if err != nil {
		return time.Time{}, err
	}
	return payload.IssuedAt, nil
}

// TokenExpiration returns the underlying token expiration.
func (c *Connection) TokenExpiration(_ context.Context) (time.Time, error) {
	payload, err := ParseToken(c.secrets.Token)
	if err != nil {
		return time.Time{}, err
	}
	return payload.ExpiresAt, nil
}

// TokenValid returns whether the underlying token is structurally valid. A bare
// refresh token (from the initial authorization) is not valid yet, prompting
// the controller to exchange it for a full payload. A refresh token is not
// required: some providers (e.g. GitHub OAuth apps) issue non-expiring access
// tokens without one.
func (c *Connection) TokenValid(_ context.Context) bool {
	payload, err := ParseToken(c.secrets.Token)
	return err == nil && payload.AccessToken != ""
}

// nonExpiringTokenTTL is the nominal expiry recorded for providers that issue
// tokens without one (e.g. GitHub OAuth apps), so the controllers do not try to
// refresh a token that never expires.
const nonExpiringTokenTTL = 10 * 365 * 24 * time.Hour

func buildPayload(token *oauth2.Token) TokenPayload {
	payload := TokenPayload{
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		IssuedAt:     time.Now(),
		ExpiresAt:    token.Expiry,
	}
	if payload.ExpiresAt.IsZero() {
		payload.ExpiresAt = payload.IssuedAt.Add(nonExpiringTokenTTL)
	}
	return payload
}

var (
	_ connection.Connection         = (*Connection)(nil)
	_ connection.TokenConnection    = (*Connection)(nil)
	_ connection.AuthCodeConnection = (*Connection)(nil)
	_ connection.AppURLConnection   = (*Connection)(nil)
)
