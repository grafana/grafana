package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/services/live/livecontext"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
)

type UserTeamSubscriberConfig struct {
	AllowedTeams []int64 `json:"allowedTeams,omitempty"`
}

type UserTeamSubscriber struct {
	config UserTeamSubscriberConfig
}

func NewUserTeamSubscriber(config UserTeamSubscriberConfig) *UserTeamSubscriber {
	return &UserTeamSubscriber{config: config}
}

const SubscriberTypeUserTeam = "userTeam"

func (s *UserTeamSubscriber) Type() string {
	return SubscriberTypeUserTeam
}

func (s *UserTeamSubscriber) Subscribe(ctx context.Context, _ Vars) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	u, ok := livecontext.GetContextSignedUser(ctx)
	if !ok {
		return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
	}
	for _, allowedTeam := range s.config.AllowedTeams {
		for _, teamID := range u.Teams {
			if allowedTeam == teamID {
				return models.SubscribeReply{}, backend.SubscribeStreamStatusOK, nil
			}
		}
	}
	return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
}
