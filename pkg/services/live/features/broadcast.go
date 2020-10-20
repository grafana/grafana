package features

import (
	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/models"
)

// BroadcastRunner will simply broadcast all events to `grafana/broadcast/*` channels
// This assumes that data is a JSON object
type BroadcastRunner struct {
}

// GetHandlerForPath called on init
func (b *BroadcastRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return b, nil // for now all channels share config
}

// GetChannelOptions called fast and often
func (b *BroadcastRunner) GetChannelOptions(id string) centrifuge.ChannelOptions {
	return centrifuge.ChannelOptions{}
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (b *BroadcastRunner) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) error {
	// anyone can subscribe
	return nil
}

// OnPublish called when an event is received from the websocket
func (b *BroadcastRunner) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) ([]byte, error) {
	// expect the data to be the right shape?
	return e.Data, nil
}
