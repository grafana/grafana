package features

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	logger = log.New("live.features") // scoped to all features?
)

//go:generate mockgen -destination=message_store_mock.go -package=features github.com/grafana/grafana/pkg/services/live/features LiveMessageStore

type LiveMessageStore interface {
	SaveLiveChannelData(query *models.SaveLiveChannelDataQuery) error
	GetLiveChannel(query *models.GetLiveChannelQuery) (models.LiveChannel, bool, error)
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
func (b *BroadcastRunner) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return b, nil // all dashboards share the same handler
}

// OnSubscribe will let anyone connect to the path
func (b *BroadcastRunner) OnSubscribe(_ context.Context, u *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	reply := models.SubscribeReply{
		Presence:  true,
		JoinLeave: true,
	}
	query := &models.GetLiveChannelQuery{
		OrgId:   u.OrgId,
		Channel: e.Channel,
	}
	msg, ok, err := b.liveMessageStore.GetLiveChannel(query)
	if err != nil {
		return models.SubscribeReply{}, 0, err
	}
	if ok {
		reply.Data = msg.Data
	}
	return reply, backend.SubscribeStreamStatusOK, nil
}

// OnPublish is called when a client wants to broadcast on the websocket
func (b *BroadcastRunner) OnPublish(_ context.Context, u *models.SignedInUser, e models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	query := &models.SaveLiveChannelDataQuery{
		OrgId:   u.OrgId,
		Channel: e.Channel,
		Data:    e.Data,
	}
	if err := b.liveMessageStore.SaveLiveChannelData(query); err != nil {
		return models.PublishReply{}, 0, err
	}
	return models.PublishReply{}, backend.PublishStreamStatusOK, nil
}
