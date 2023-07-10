package process

import "context"

type Service interface {
	// Start executes a backend plugin process.
	Start(ctx context.Context, pluginUID string) error
	// Stop terminates a backend plugin process.
	Stop(ctx context.Context, pluginUID string) error
}
