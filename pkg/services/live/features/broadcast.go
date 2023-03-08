package features

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/live/model"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	logger = log.New("live.features") // scoped to all features?
)

//go:generate mockgen -destination=broadcast_mock.go -package=features github.com/grafana/grafana/pkg/services/live/features LiveMessageStore

type LiveMessageStore interface {
	SaveLiveMessage(query *model.SaveLiveMessageQuery) error
	GetLiveMessage(query *model.GetLiveMessageQuery) (model.LiveMessage, bool, error)
}

// BroadcastRunner will simply broadcast all events to `grafana/broadcast/*` channels
// This assumes that data is a JSON object
type BroadcastRunner struct {
	liveMessageStore LiveMessageStore
}

func NewBroadcastRunner(liveMessageStore LiveMessageStore) *BroadcastRunner {
	return &BroadcastRunner{liveMessageStore: liveMessageStore}
}

// GetHandlerForPath called on init
func (b *BroadcastRunner) GetHandlerForPath(_ string) (model.ChannelHandler, error) {
	return b, nil // all dashboards share the same handler
}

// OnSubscribe will let anyone connect to the path
func (b *BroadcastRunner) OnSubscribe(_ context.Context, u *user.SignedInUser, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	reply := model.SubscribeReply{
		Presence:  true,
		JoinLeave: true,
	}
	query := &model.GetLiveMessageQuery{
		OrgID:   u.OrgID,
		Channel: e.Channel,
	}
	msg, ok, err := b.liveMessageStore.GetLiveMessage(query)
	if err != nil {
		return model.SubscribeReply{}, 0, err
	}
	if ok {
		reply.Data = msg.Data
	}
	return reply, backend.SubscribeStreamStatusOK, nil
}

// OnPublish is called when a client wants to broadcast on the websocket
func (b *BroadcastRunner) OnPublish(_ context.Context, u *user.SignedInUser, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	query := &model.SaveLiveMessageQuery{
		OrgID:   u.OrgID,
		Channel: e.Channel,
		Data:    e.Data,
	}
	if err := b.liveMessageStore.SaveLiveMessage(query); err != nil {
		return model.PublishReply{}, 0, err
	}
	return model.PublishReply{Data: e.Data}, backend.PublishStreamStatusOK, nil
}
