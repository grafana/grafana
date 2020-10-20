package features

import (
	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/models"
)

// BroadcastRunner will simply broadcast all events to `grafana/broadcast/*` channels
// This makes no assumptions about the shape of the data and will broadcast it to anyone listening
type BroadcastRunner struct{}

// GetHandlerForPath called on init
func (g *BroadcastRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return g, nil // for now all channels share config
}

// GetChannelOptions called fast and often
func (g *BroadcastRunner) GetChannelOptions(id string) centrifuge.ChannelOptions {
	return centrifuge.ChannelOptions{}
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (g *BroadcastRunner) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) error {
	// anyone can subscribe
	return nil
}

// OnPublish called when an event is received from the websocket
func (g *BroadcastRunner) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) ([]byte, error) {
	// expect the data to be the right shape?
	return e.Data, nil
}
