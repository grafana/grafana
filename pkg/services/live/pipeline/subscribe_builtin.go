package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/live"

	"github.com/grafana/grafana/pkg/services/live/livecontext"
	"github.com/grafana/grafana/pkg/services/live/model"
	"github.com/grafana/grafana/pkg/services/user"
)

type BuiltinSubscriber struct {
	channelHandlerGetter ChannelHandlerGetter
}

type ChannelHandlerGetter interface {
	GetChannelHandler(ctx context.Context, user *user.SignedInUser, channel string) (model.ChannelHandler, live.Channel, error)
}

const SubscriberTypeBuiltin = "builtin"

func NewBuiltinSubscriber(channelHandlerGetter ChannelHandlerGetter) *BuiltinSubscriber {
	return &BuiltinSubscriber{channelHandlerGetter: channelHandlerGetter}
}

func (s *BuiltinSubscriber) Type() string {
	return SubscriberTypeBuiltin
}

func (s *BuiltinSubscriber) Subscribe(ctx context.Context, vars Vars, data []byte) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	u, ok := livecontext.GetContextSignedUser(ctx)
	if !ok {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
	}
	handler, _, err := s.channelHandlerGetter.GetChannelHandler(ctx, u, vars.Channel)
	if err != nil {
		return model.SubscribeReply{}, 0, err
	}
	return handler.OnSubscribe(ctx, u, model.SubscribeEvent{
		Channel: vars.Channel,
		Path:    vars.Path,
		Data:    data,
	})
}
