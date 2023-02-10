package process

import "context"

type Service interface {
	// Start executes a backend plugin process.
	Start(ctx context.Context, pluginID string) error
	// Stop terminates a backend plugin process.
	Stop(ctx context.Context, pluginID string) error
	// Shutdown terminates all backend plugin processes.
	Shutdown(ctx context.Context) error
}
