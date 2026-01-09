package connection

import (
	"context"
)

//go:generate mockery --name Connection --structname MockConnection --inpackage --filename connection_mock.go --with-expecter
type Connection interface {
	// Validate ensures the resource _looks_ correct.
	// It should be called before trying to upsert a resource into the Kubernetes API server.
	// This is not an indication that the connection information works, just that they are reasonably configured.
	Validate(ctx context.Context) error

	// Mutate performs in place mutation of the underneath resource.
	Mutate(context.Context) error
}
