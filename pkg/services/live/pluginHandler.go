package live

import (
	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

// PluginHandler manages all the `grafana/dashboard/*` channels
type PluginHandler struct {
	Plugin *plugins.PluginBase
}

// GetHandlerForPath called on init
func (g *PluginHandler) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return g, nil // all dashboards share the same handler
}

// GetChannelOptions called fast and often
func (g *PluginHandler) GetChannelOptions(id string) centrifuge.ChannelOptions {
	return centrifuge.ChannelOptions{}
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (g *PluginHandler) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) error {
	return nil // anyone can subscribe
}

// OnPublish called when an event is received from the websocket
func (g *PluginHandler) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) ([]byte, error) {
	return e.Data, nil // broadcast any event
}
