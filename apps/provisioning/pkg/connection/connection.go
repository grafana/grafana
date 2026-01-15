package connection

import (
	"context"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

//go:generate mockery --name Connection --structname MockConnection --inpackage --filename connection_mock.go --with-expecter
type Connection interface {
	// Validate ensures the resource _looks_ correct.
	// It should be called before trying to upsert a resource into the Kubernetes API server.
	// This is not an indication that the connection information works, just that they are reasonably configured.
	Validate(ctx context.Context) error

	// GenerateRepositoryToken generates a repository-scoped access token.
	// For GitHub connections, this creates an installation token using the GitHub App credentials.
	// The repo parameter specifies the repository name the token should be scoped to.
	GenerateRepositoryToken(ctx context.Context, repo *provisioning.Repository) (common.RawSecureValue, error)
}
