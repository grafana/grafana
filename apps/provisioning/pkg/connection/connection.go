package connection

import (
	"context"

	"errors"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var (
	ErrNotImplemented   = errors.New("not implemented")
	ErrNotFound         = errors.New("not found")
	ErrRepositoryAccess = errors.New("cannot access repository")
	ErrAuthentication   = errors.New("authentication failed")
)

type ExpirableSecureValue struct {
	Token     common.RawSecureValue
	ExpiresAt time.Time
}

//go:generate mockery --name Connection --structname MockConnection --inpackage --filename connection_mock.go --with-expecter
type Connection interface {
	// GenerateRepositoryToken generates a repository-scoped access token.
	// The repo parameter specifies the repository name the token should be scoped to.
	GenerateRepositoryToken(ctx context.Context, repo *provisioning.Repository) (*ExpirableSecureValue, error)

	// ListRepositories returns the list of repositories accessible through this connection.
	// The repositories returned are external repositories from the git provider (e.g., GitHub, GitLab).
	ListRepositories(ctx context.Context) ([]provisioning.ExternalRepository, error)

	// Test checks if the connection information actually works.
	Test(ctx context.Context) (*provisioning.TestResults, error)
}

// TokenConnection is an optional interface that connections can implement if they need
// to handle tokens in their secrets.
//
//go:generate mockery --name TokenConnection --structname MockTokenConnection --inpackage --filename connection_token_mock.go --with-expecter
type TokenConnection interface {
	// ValidateToken checks that the stored token can authenticate requests
	// right now, and reports when it stops working (zero when it never expires).
	ValidateToken() (expiresAt time.Time, err error)
	// GenerateConnectionToken mints a new connection-level token and returns it.
	GenerateConnectionToken(ctx context.Context) (common.RawSecureValue, error)
}

// OAuthConnection is the interface implemented by all OAuth app connections.
//
//go:generate mockery --name OAuthConnection --structname MockOAuthConnection --inpackage --filename connection_oauth_mock.go --with-expecter
type OAuthConnection interface {
	// ExchangeAuthorizationCode exchanges an OAuth authorization code for tokens.
	// Returns the value to store as the connection token.
	ExchangeAuthorizationCode(ctx context.Context, code, redirectURI string) (common.RawSecureValue, error)
}
