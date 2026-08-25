package backendplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
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
	backend.QueryChunkedDataHandler
	backend.CallResourceHandler
	backend.AdmissionHandler
	backend.ConversionHandler
	backend.StreamHandler
}

// PluginV3 is implemented by backend plugins that expose a V3 client.
type PluginV3 interface {
	ClientV3(ctx context.Context) (v3.ClientV3, bool)
}

type Target string

const (
	TargetNone     Target = "none"
	TargetUnknown  Target = "unknown"
	TargetInMemory Target = "in_memory"
	TargetLocal    Target = "local"
)
