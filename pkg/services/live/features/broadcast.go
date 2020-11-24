package features

import (
	"time"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/models"
)

// BroadcastRunner will simply broadcast all events to `grafana/broadcast/*` channels
// This assumes that data is a JSON object
type BroadcastRunner struct{}

// GetHandlerForPath called on init
func (b *BroadcastRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return b, nil // all dashboards share the same handler
}

// OnSubscribe will let anyone connect to the path
func (b *BroadcastRunner) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
	return centrifuge.SubscribeReply{
		Options: centrifuge.SubscribeOptions{
			Presence:  true,
			JoinLeave: true,
			Recover:   true, // loads the saved value from history
		},
	}, nil
}

// OnPublish is called when a client wants to broadcast on the websocket
func (b *BroadcastRunner) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) (centrifuge.PublishReply, error) {
	return centrifuge.PublishReply{
		Options: centrifuge.PublishOptions{
			HistorySize: 1, // The last message is saved for 10 mins
			HistoryTTL:  10 * time.Minute,
		},
	}, nil
}
