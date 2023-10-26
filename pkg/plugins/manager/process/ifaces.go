package process

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

type Manager interface {
	// Start executes a backend plugin process.
	Start(ctx context.Context, p backendplugin.Plugin) error
	// Stop terminates a backend plugin process.
	Stop(ctx context.Context, p backendplugin.Plugin) error
}
