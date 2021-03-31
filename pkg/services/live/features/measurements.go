package features

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

var (
	logger = log.New("live.features") // scoped to all features?
)

// MeasurementsRunner will simply broadcast all events to `grafana/broadcast/*` channels.
// This makes no assumptions about the shape of the data and will broadcast it to anyone listening
type MeasurementsRunner struct {
}

// GetHandlerForPath gets the handler for a path.
// It's called on init.
func (m *MeasurementsRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return m, nil // for now all channels share config
}

// OnSubscribe will let anyone connect to the path
func (m *MeasurementsRunner) OnSubscribe(ctx context.Context, _ *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, bool, error) {
	return models.SubscribeReply{}, true, nil
}

// OnPublish is called when a client wants to broadcast on the websocket
// Currently this sends measurements over websocket -- should be replaced with the HTTP interface
func (m *MeasurementsRunner) OnPublish(ctx context.Context, _ *models.SignedInUser, e models.PublishEvent) (models.PublishReply, bool, error) {
	return models.PublishReply{}, true, nil
}
