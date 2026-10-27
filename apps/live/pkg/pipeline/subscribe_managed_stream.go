package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/apps/live/pkg/managedstream"
	"github.com/grafana/grafana/apps/live/pkg/model"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type ManagedStreamSubscriber struct {
	managedStream *managedstream.Runner
}

const SubscriberTypeManagedStream = "managedStream"

func NewManagedStreamSubscriber(managedStream *managedstream.Runner) *ManagedStreamSubscriber {
	return &ManagedStreamSubscriber{managedStream: managedStream}
}

func (s *ManagedStreamSubscriber) Type() string {
	return SubscriberTypeManagedStream
}

func (s *ManagedStreamSubscriber) Subscribe(ctx context.Context, vars Vars, _ []byte) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	stream, err := s.managedStream.GetOrCreateStream(vars.NS, vars.Scope, vars.Stream)
	if err != nil {
		logger.Error("Error getting managed stream", "error", err)
		return model.SubscribeReply{}, 0, err
	}
	u, err := identity.GetRequester(ctx)
	if err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
	}
	return stream.OnSubscribe(ctx, u, model.SubscribeEvent{
		Channel: vars.Channel,
		Path:    vars.Path,
	})
}
