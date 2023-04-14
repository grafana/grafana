package pipeline

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/services/live/livecontext"
	"github.com/grafana/grafana/pkg/services/live/model"
)

type BuiltinDataOutput struct {
	channelHandlerGetter ChannelHandlerGetter
}

const DataOutputTypeBuiltin = "builtin"

func NewBuiltinDataOutput(channelHandlerGetter ChannelHandlerGetter) *BuiltinDataOutput {
	return &BuiltinDataOutput{channelHandlerGetter: channelHandlerGetter}
}

func (s *BuiltinDataOutput) Type() string {
	return DataOutputTypeBuiltin
}

func (s *BuiltinDataOutput) OutputData(ctx context.Context, vars Vars, data []byte) ([]*ChannelData, error) {
	u, ok := livecontext.GetContextSignedUser(ctx)
	if !ok {
		return nil, errors.New("user not found in context")
	}
	handler, _, err := s.channelHandlerGetter.GetChannelHandler(ctx, u, vars.Channel)
	if err != nil {
		return nil, err
	}
	_, status, err := handler.OnPublish(ctx, u, model.PublishEvent{
		Channel: vars.Channel,
		Data:    data,
	})
	if err != nil {
		return nil, err
	}
	if status != backend.PublishStreamStatusOK {
		return nil, errors.New("unauthorized publish")
	}
	return nil, nil
}
