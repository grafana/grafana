package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/services/live/livecontext"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
	"github.com/grafana/grafana/pkg/services/live/model"
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
	stream, err := s.managedStream.GetOrCreateStream(vars.OrgID, vars.Scope, vars.Namespace)
	if err != nil {
		logger.Error("Error getting managed stream", "error", err)
		return model.SubscribeReply{}, 0, err
	}
	u, ok := livecontext.GetContextSignedUser(ctx)
	if !ok {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
	}
	return stream.OnSubscribe(ctx, u, model.SubscribeEvent{
		Channel: vars.Channel,
		Path:    vars.Path,
	})
}
