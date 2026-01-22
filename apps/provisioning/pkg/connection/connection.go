package connection

import (
	"context"

	"errors"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var (
	ErrNotImplemented = errors.New("not implemented")
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
	// TokenExpired returns true if the underlying token secret is expired.
	TokenExpired(ctx context.Context) (bool, error)
	// GenerateConnectionToken generates a connection-level token.
	// Returns the generated token value.
	GenerateConnectionToken(ctx context.Context) (common.RawSecureValue, error)
}
