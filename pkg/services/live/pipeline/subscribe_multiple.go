package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
)

type MultipleSubscriber struct {
	Subscribers []Subscriber
}

func NewMultipleSubscriber(subscribers ...Subscriber) *MultipleSubscriber {
	return &MultipleSubscriber{Subscribers: subscribers}
}

const SubscriberTypeMultiple = "multiple"

func (s *MultipleSubscriber) Type() string {
	return SubscriberTypeMultiple
}

func (s *MultipleSubscriber) Subscribe(ctx context.Context, vars Vars, data []byte) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	finalReply := models.SubscribeReply{}

	for _, s := range s.Subscribers {
		reply, status, err := s.Subscribe(ctx, vars, data)
		if err != nil {
			return models.SubscribeReply{}, 0, err
		}
		if status != backend.SubscribeStreamStatusOK {
			return models.SubscribeReply{}, status, nil
		}
		if finalReply.Data == nil {
			finalReply.Data = reply.Data
		}
		if !finalReply.JoinLeave {
			finalReply.JoinLeave = reply.JoinLeave
		}
		if !finalReply.Presence {
			finalReply.Presence = reply.Presence
		}
		if !finalReply.Recover {
			finalReply.Recover = reply.Recover
		}
	}
	return finalReply, backend.SubscribeStreamStatusOK, nil
}
