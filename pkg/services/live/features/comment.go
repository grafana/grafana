package features

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/comments/commentmodel"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// ChatHandler manages all the `grafana/chat/*` channels.
type ChatHandler struct {
	permissionChecker *commentmodel.PermissionChecker
}

func NewCommentHandler(permissionChecker *commentmodel.PermissionChecker) *ChatHandler {
	return &ChatHandler{permissionChecker: permissionChecker}
}

// GetHandlerForPath called on init.
func (h *ChatHandler) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return h, nil // all chats share the same handler
}

// OnSubscribe for now allows anyone to subscribe to any chat.
func (h *ChatHandler) OnSubscribe(ctx context.Context, user *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	parts := strings.Split(e.Path, "/")
	if len(parts) != 2 {
		return models.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
	}
	contentType := parts[0]
	objectID := parts[1]
	ok, err := h.permissionChecker.CheckReadPermissions(ctx, user.OrgId, user, contentType, objectID)
	if err != nil {
		return models.SubscribeReply{}, 0, err
	}
	if !ok {
		return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
	}
	return models.SubscribeReply{
		Presence:  true,
		JoinLeave: true,
	}, backend.SubscribeStreamStatusOK, nil
}

// OnPublish is not used for chats.
func (h *ChatHandler) OnPublish(_ context.Context, _ *models.SignedInUser, _ models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	return models.PublishReply{}, backend.PublishStreamStatusPermissionDenied, nil
}
