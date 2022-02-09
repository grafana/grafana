package features

import (
	"context"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/chats/chatmodel"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// ChatHandler manages all the `grafana/chat/*` channels.
type ChatHandler struct {
	permissionChecker *chatmodel.PermissionChecker
}

func NewChatHandler(permissionChecker *chatmodel.PermissionChecker) *ChatHandler {
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
	contentTypeID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return models.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
	}
	objectID := parts[1]
	ok, err := h.permissionChecker.CheckReadPermissions(ctx, user.OrgId, user, int(contentTypeID), objectID)
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
