package plugin

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/router"
)

// pluginBackend serves a plugin under the selected route
type pluginRouterLoader struct {
}

var _ router.RoutesLoader = &pluginRouterLoader{}

// NewPluginBackend will be called on startup and when any plugins change
// This will not initialize any long running state
func NewPluginRouterLoader(bundle plugins.FoundBundle, client plugins.Client) (router.RoutesLoader, error) {
	// TODO, find manifest etc
	return &pluginRouterLoader{}, nil
}

// Load implements [router.RoutesLoader].
func (p *pluginRouterLoader) Load(context.Context) ([]router.Backend, error) {
	panic("unimplemented")
}

// Notify implements [router.RoutesLoader].
func (p *pluginRouterLoader) Notify(context.Context) (<-chan struct{}, error) {
	panic("unimplemented")
}
