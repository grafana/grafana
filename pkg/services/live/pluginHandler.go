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

// OnSubscribe for now allows anyone to subscribe
func (g *PluginHandler) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
	return centrifuge.SubscribeReply{}, nil
}

// OnPublish checks if a message from the websocket can be broadcast on this channel
func (g *PluginHandler) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) (centrifuge.PublishReply, error) {
	return centrifuge.PublishReply{}, nil // broadcast any event
}
