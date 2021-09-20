package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/live/livecontext"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/live"
)

type BuiltinSubscriber struct {
	channelHandlerGetter ChannelHandlerGetter
}

type ChannelHandlerGetter interface {
	GetChannelHandler(user *models.SignedInUser, channel string) (models.ChannelHandler, live.Channel, error)
}

func NewBuiltinSubscriber(channelHandlerGetter ChannelHandlerGetter) *BuiltinSubscriber {
	return &BuiltinSubscriber{channelHandlerGetter: channelHandlerGetter}
}

func (m *BuiltinSubscriber) Subscribe(ctx context.Context, vars Vars) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	u, ok := livecontext.GetContextSignedUser(ctx)
	if !ok {
		return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
	}
	handler, _, err := m.channelHandlerGetter.GetChannelHandler(u, vars.Channel)
	if err != nil {
		return models.SubscribeReply{}, 0, err
	}
	return handler.OnSubscribe(ctx, u, models.SubscribeEvent{
		Channel: vars.Channel,
		Path:    vars.Path,
	})
}
