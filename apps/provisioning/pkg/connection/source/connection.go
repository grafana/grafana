// Package source implements the Connection that holds the credentials of a Source API:
// an OAuth client-credentials grant, kept fresh by the connection controller.
package source

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type sourceConnection struct {
	cfg          provisioning.SourceConnectionConfig
	clientID     string
	clientSecret common.RawSecureValue
	token        common.RawSecureValue
	httpClient   *http.Client
}

var (
	_ connection.Connection      = (*sourceConnection)(nil)
	_ connection.TokenConnection = (*sourceConnection)(nil)
)

// Test checks the stored token. It does not call the token endpoint: the controller
// mints a token when there is none, so a missing one is a state to wait out, not a fault.
func (c *sourceConnection) Test(context.Context) (*provisioning.TestResults, error) {
	token, err := parseToken(c.token)
	switch {
	case err != nil || token.AccessToken == "":
		return connection.FailedTestResults(http.StatusUnauthorized, []provisioning.ErrorDetails{{
			Type:   metav1.CauseTypeFieldValueRequired,
			Field:  field.NewPath("secure", "token").String(),
			Detail: "No token has been generated for this connection yet",
		}}), nil
	case !token.Expiry.IsZero() && time.Now().After(token.Expiry):
		return connection.FailedTestResults(http.StatusUnauthorized, []provisioning.ErrorDetails{{
			Type:   metav1.CauseTypeFieldValueInvalid,
			Field:  field.NewPath("secure", "token").String(),
			Detail: "The connection's access token has expired",
		}}), nil
	}
	return connection.SuccessTestResults(), nil
}

// GenerateRepositoryToken hands a repository the connection's access token: client
// credentials are not repository scoped.
func (c *sourceConnection) GenerateRepositoryToken(_ context.Context, repo *provisioning.Repository) (*connection.ExpirableSecureValue, error) {
	if repo == nil {
		return nil, errors.New("a repository is required to generate a token")
	}
	if repo.Spec.Type != provisioning.SourceRepositoryType {
		return nil, fmt.Errorf("repository type %q is not served by this connection", repo.Spec.Type)
	}

	token, err := parseToken(c.token)
	if err != nil || token.AccessToken == "" {
		return nil, fmt.Errorf("connection access token not available: %w", connection.ErrAuthentication)
	}
	if !token.Expiry.IsZero() && time.Now().After(token.Expiry) {
		return nil, fmt.Errorf("connection access token expired: %w", connection.ErrAuthentication)
	}
	return &connection.ExpirableSecureValue{Token: common.RawSecureValue(token.AccessToken), ExpiresAt: token.Expiry}, nil
}

func (c *sourceConnection) ValidateToken() (time.Time, error) {
	token, err := parseToken(c.token)
	if err != nil {
		return time.Time{}, err
	}
	if token.AccessToken == "" {
		return time.Time{}, errors.New("stored token has no access token")
	}
	return token.Expiry, nil
}

// GenerateConnectionToken runs the client-credentials grant against the configured token endpoint.
func (c *sourceConnection) GenerateConnectionToken(ctx context.Context) (*connection.ExpirableSecureValue, error) {
	cfg := clientcredentials.Config{
		ClientID:     c.clientID,
		ClientSecret: string(c.clientSecret),
		TokenURL:     c.cfg.TokenURL,
		Scopes:       c.cfg.Scopes,
		AuthStyle:    oauth2.AuthStyleAutoDetect,
	}
	if c.cfg.Audience != "" {
		cfg.EndpointParams = url.Values{"audience": {c.cfg.Audience}}
	}
	if c.httpClient != nil {
		ctx = context.WithValue(ctx, oauth2.HTTPClient, c.httpClient)
	}

	token, err := cfg.Token(ctx)
	if err != nil {
		if rejected(err) {
			return nil, fmt.Errorf("request access token: %w: %w", connection.ErrAuthentication, err)
		}
		return nil, fmt.Errorf("request access token: %w", err)
	}

	raw, err := json.Marshal(token) // #nosec G117 -- intentional serialization into a secure value for the secret store
	if err != nil {
		return nil, err
	}
	// A zero expiry means the endpoint issued a non-expiring token.
	return &connection.ExpirableSecureValue{Token: common.RawSecureValue(raw), ExpiresAt: token.Expiry}, nil
}

// rejected reports whether the endpoint refused the client credentials, which the
// user has to fix, as opposed to a transient failure that is retried.
func rejected(err error) bool {
	var retrieveErr *oauth2.RetrieveError
	if !errors.As(err, &retrieveErr) {
		return false
	}
	if retrieveErr.ErrorCode == "invalid_client" || retrieveErr.ErrorCode == "unauthorized_client" {
		return true
	}
	if retrieveErr.Response != nil {
		return retrieveErr.Response.StatusCode == http.StatusUnauthorized || retrieveErr.Response.StatusCode == http.StatusForbidden
	}
	return false
}

// parseToken decodes the stored token, which keeps its expiry next to the access token.
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
