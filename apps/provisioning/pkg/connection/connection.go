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

// TokenGenerator is an optional interface that connections can implement if they need
// to generate connection-level tokens.
type TokenGenerator interface {
	// GenerateConnectionToken generates a connection-level token.
	// Returns the generated token value.
	GenerateConnectionToken(ctx context.Context) (common.RawSecureValue, error)
}
