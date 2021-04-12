package features

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	logger = log.New("live.features") // scoped to all features?
)

// BroadcastRunner will simply broadcast all events to `grafana/broadcast/*` channels
// This assumes that data is a JSON object
type BroadcastRunner struct {
	Bus bus.Bus
}

// GetHandlerForPath called on init
func (b *BroadcastRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return b, nil // all dashboards share the same handler
}

// OnSubscribe will let anyone connect to the path
func (b *BroadcastRunner) OnSubscribe(ctx context.Context, u *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	reply := models.SubscribeReply{
		Presence:  true,
		JoinLeave: true,
		Recover:   true, // loads the saved value from history
	}
	query := &models.GetLastBroadcastMessageQuery{
		Params: models.GetLastBroadcastMessageQueryParams{
			OrgId:   u.OrgId,
			Channel: e.Channel,
		},
	}
	if err := b.Bus.Dispatch(query); err != nil {
		return models.SubscribeReply{}, 0, err
	}
	if query.Result != nil {
		reply.Data = query.Result.Data
	}
	return reply, backend.SubscribeStreamStatusOK, nil
}

// OnPublish is called when a client wants to broadcast on the websocket
func (b *BroadcastRunner) OnPublish(ctx context.Context, u *models.SignedInUser, e models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	query := &models.SaveBroadcastMessageQuery{
		Params: models.SaveBroadcastMessageQueryParams{
			OrgId:     u.OrgId,
			Channel:   e.Channel,
			Data:      e.Data,
			CreatedBy: u.UserId,
		},
	}
	if err := b.Bus.Dispatch(query); err != nil {
		return models.PublishReply{}, 0, err
	}
	return models.PublishReply{
		HistorySize: 1, // The last message is saved for 10 min.
		HistoryTTL:  10 * time.Minute,
	}, backend.PublishStreamStatusOK, nil
}
