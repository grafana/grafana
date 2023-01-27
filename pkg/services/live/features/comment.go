package features

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/services/comments/commentmodel"
	"github.com/grafana/grafana/pkg/services/live/model"
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
func (h *CommentHandler) GetHandlerForPath(_ string) (model.ChannelHandler, error) {
	return h, nil // all chats share the same handler
}

// OnSubscribe handles subscription to comment group channel.
func (h *CommentHandler) OnSubscribe(ctx context.Context, user *user.SignedInUser, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	parts := strings.Split(e.Path, "/")
	if len(parts) != 2 {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
	}
	objectType := parts[0]
	objectID := parts[1]
	ok, err := h.permissionChecker.CheckReadPermissions(ctx, user.OrgID, user, objectType, objectID)
	if err != nil {
		return model.SubscribeReply{}, 0, err
	}
	if !ok {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, nil
	}
	return model.SubscribeReply{}, backend.SubscribeStreamStatusOK, nil
}

// OnPublish is not used for comments.
func (h *CommentHandler) OnPublish(_ context.Context, _ *user.SignedInUser, _ model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	return model.PublishReply{}, backend.PublishStreamStatusPermissionDenied, nil
}
