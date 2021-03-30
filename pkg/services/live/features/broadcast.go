package features

import (
	"context"
	"time"

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
func (b *BroadcastRunner) OnSubscribe(ctx context.Context, _ *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, bool, error) {
	return models.SubscribeReply{
		Presence:  true,
		JoinLeave: true,
		Recover:   true, // loads the saved value from history
	}, true, nil
}

// OnPublish is called when a client wants to broadcast on the websocket
func (b *BroadcastRunner) OnPublish(ctx context.Context, _ *models.SignedInUser, e models.PublishEvent) (models.PublishReply, bool, error) {
	return models.PublishReply{
		HistorySize: 1, // The last message is saved for 10 min.
		HistoryTTL:  10 * time.Minute,
	}, true, nil
}
