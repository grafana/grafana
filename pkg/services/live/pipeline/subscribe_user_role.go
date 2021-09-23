package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/services/live/livecontext"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
)

type UserRoleSubscriberConfig struct {
	RequiredRole models.RoleType `json:"requiredRole,omitempty"`
}

type UserRoleSubscriber struct {
	config UserRoleSubscriberConfig
}

func NewUserRoleSubscriber(config UserRoleSubscriberConfig) *UserRoleSubscriber {
	return &UserRoleSubscriber{config: config}
}

const SubscriberTypeUserRole = "userRole"

func (s *UserRoleSubscriber) Type() string {
	return SubscriberTypeUserRole
}

func (s *UserRoleSubscriber) Subscribe(ctx context.Context, _ Vars) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	u, ok := livecontext.GetContextSignedUser(ctx)
	if !ok {
		return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
	}
	if u.HasRole(s.config.RequiredRole) {
		return models.SubscribeReply{}, backend.SubscribeStreamStatusOK, nil
	}
	return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
}
