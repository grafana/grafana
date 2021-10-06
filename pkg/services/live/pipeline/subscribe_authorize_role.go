package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/services/live/livecontext"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
)

type AuthorizeRoleSubscriberConfig struct {
	Role models.RoleType `json:"role,omitempty"`
}

type AuthorizeRoleSubscriber struct {
	config AuthorizeRoleSubscriberConfig
}

func NewAuthorizeRoleSubscriber(config AuthorizeRoleSubscriberConfig) *AuthorizeRoleSubscriber {
	return &AuthorizeRoleSubscriber{config: config}
}

const SubscriberTypeAuthorizeRole = "authorizeRole"

func (s *AuthorizeRoleSubscriber) Type() string {
	return SubscriberTypeAuthorizeRole
}

func (s *AuthorizeRoleSubscriber) Subscribe(ctx context.Context, _ Vars) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	u, ok := livecontext.GetContextSignedUser(ctx)
	if !ok {
		return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
	}
	if u.HasRole(s.config.Role) {
		return models.SubscribeReply{}, backend.SubscribeStreamStatusOK, nil
	}
	return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
}
