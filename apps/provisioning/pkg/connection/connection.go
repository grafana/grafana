package connection

import (
	"context"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

//go:generate mockery --name Connection --structname MockConnection --inpackage --filename connection_mock.go --with-expecter
type Connection interface {
	// Validate ensures the resource _looks_ correct.
	// It should be called before trying to upsert a resource into the Kubernetes API server.
	// This is not an indication that the connection information works, just that they are reasonably configured.
	Validate(ctx context.Context) error

	// Mutate performs in place mutation of the underneath resource.
	Mutate(context.Context) error

	// ListRepositories returns the list of repositories accessible through this connection.
	// The repositories returned are external repositories from the git provider (e.g., GitHub, GitLab).
	ListRepositories(ctx context.Context) ([]provisioning.ExternalRepository, error)
}
