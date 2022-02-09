package features

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
)

// ChatHandler manages all the `grafana/chat/*` channels.
type ChatHandler struct{}

// GetHandlerForPath called on init.
func (h *ChatHandler) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return h, nil // all chats share the same handler
}

// OnSubscribe for now allows anyone to subscribe to any chat.
func (h *ChatHandler) OnSubscribe(ctx context.Context, user *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	return models.SubscribeReply{
		Presence:  true,
		JoinLeave: true,
	}, backend.SubscribeStreamStatusOK, nil
}

// OnPublish is not used for chats.
func (h *ChatHandler) OnPublish(ctx context.Context, user *models.SignedInUser, e models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	return models.PublishReply{}, backend.PublishStreamStatusPermissionDenied, nil
}
