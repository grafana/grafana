package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
)

type PermissionDeniedSubscriber struct{}

func NewPermissionDeniedSubscriber() *PermissionDeniedSubscriber {
	return &PermissionDeniedSubscriber{}
}

func (m *PermissionDeniedSubscriber) Subscribe(ctx context.Context, vars Vars) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
}
