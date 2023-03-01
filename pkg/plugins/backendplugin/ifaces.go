package backendplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins/log"
)

// Plugin is the backend plugin interface.
type Plugin interface {
	PluginID() string
	Logger() log.Logger
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	IsManaged() bool
	Exited() bool
	Decommission() error
	IsDecommissioned() bool
	Target() Target
	backend.CollectMetricsHandler
	backend.CheckHealthHandler
	backend.QueryDataHandler
	backend.CallResourceHandler
	backend.StreamHandler
}

type Target string

const (
	TargetNone     Target = "none"
	TargetUnknown  Target = "unknown"
	TargetInMemory Target = "in_memory"
	TargetLocal    Target = "local"
)
