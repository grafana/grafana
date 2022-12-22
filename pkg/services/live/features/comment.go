package features

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/comments/commentmodel"
	"github.com/grafana/grafana/pkg/services/user"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// CommentHandler manages all the `grafana/comment/*` channels.
type CommentHandler struct {
	permissionChecker *commentmodel.PermissionChecker
}

func NewCommentHandler(permissionChecker *commentmodel.PermissionChecker) *CommentHandler {
	return &CommentHandler{permissionChecker: permissionChecker}
}

// GetHandlerForPath called on init.
func (h *CommentHandler) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return h, nil // all chats share the same handler
}

// OnSubscribe handles subscription to comment group channel.
func (h *CommentHandler) OnSubscribe(ctx context.Context, user *user.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	parts := strings.Split(e.Path, "/")
	if len(parts) != 2 {
		return models.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
	}
	objectType := parts[0]
	objectID := parts[1]
	ok, err := h.permissionChecker.CheckReadPermissions(ctx, user.OrgID, user, objectType, objectID)
	if err != nil {
		return models.SubscribeReply{}, 0, err
	}
	if !ok {
		return models.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
	}
	return models.SubscribeReply{}, backend.SubscribeStreamStatusOK, nil
}

// OnPublish is not used for comments.
func (h *CommentHandler) OnPublish(_ context.Context, _ *user.SignedInUser, _ models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	return models.PublishReply{}, backend.PublishStreamStatusPermissionDenied, nil
}
