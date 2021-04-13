package features

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	logger = log.New("live.features") // scoped to all features?
)

//go:generate mockgen -destination=dispatcher_mock.go -package=features github.com/grafana/grafana/pkg/services/live/features Dispatcher

type Dispatcher interface {
	Dispatch(msg bus.Msg) error
}

// BroadcastRunner will simply broadcast all events to `grafana/broadcast/*` channels
// This assumes that data is a JSON object
type BroadcastRunner struct {
	Dispatcher Dispatcher
}

func NewBroadcastRunner(dispatcher Dispatcher) *BroadcastRunner {
	return &BroadcastRunner{Dispatcher: dispatcher}
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
	}
	query := &models.GetLastLiveMessageQuery{
		Params: models.GetLastLiveMessageQueryParams{
			OrgId:   u.OrgId,
			Channel: e.Channel,
		},
	}
	if err := b.Dispatcher.Dispatch(query); err != nil {
		return models.SubscribeReply{}, 0, err
	}
	if query.Result != nil {
		reply.Data = query.Result.Data
	}
	return reply, backend.SubscribeStreamStatusOK, nil
}

// OnPublish is called when a client wants to broadcast on the websocket
func (b *BroadcastRunner) OnPublish(ctx context.Context, u *models.SignedInUser, e models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	query := &models.SaveLiveMessageQuery{
		Params: models.SaveLiveMessageQueryParams{
			OrgId:     u.OrgId,
			Channel:   e.Channel,
			Data:      e.Data,
			CreatedBy: u.UserId,
		},
	}
	if err := b.Dispatcher.Dispatch(query); err != nil {
		return models.PublishReply{}, 0, err
	}
	return models.PublishReply{}, backend.PublishStreamStatusOK, nil
}
