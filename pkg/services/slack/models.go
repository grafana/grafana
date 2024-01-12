package slack

import (
	"context"
	"github.com/grafana/grafana/pkg/api/dtos"
)

type Service interface {
	GetUserConversations(ctx context.Context) (*dtos.SlackChannels, error)
}
